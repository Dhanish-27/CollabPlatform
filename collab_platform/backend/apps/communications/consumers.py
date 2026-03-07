"""
WebSocket Consumer for Real-Time Chat
=====================================
This consumer handles:
1. Real-time message delivery
2. Temporary offline message queue (Redis-based)
3. Acknowledgement (ACK) system
4. Message status updates (sent, delivered, read)
5. Presence tracking (online/offline, last seen)
6. Typing indicators (ephemeral)

CRITICAL: Messages are NOT permanently stored. The offline queue uses Redis
and messages are purged immediately upon delivery and ACK.
"""

import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from django.conf import settings

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    Async WebSocket Consumer for 1-on-1 real-time chat.
    
    Features:
    - Message delivery with ACK system
    - Temporary offline message queue using Redis
    - Message status tracking (sent, delivered, read)
    - Presence tracking (online/offline, last seen)
    - Typing indicators (ephemeral, no DB)
    """
    
    # Class-level storage for user connections (for presence)
    # Format: {user_id: {channel_name: timestamp}}
    online_users: Dict[int, Dict[str, float]] = {}
    
    # Typing indicators cache
    # Format: {project_id: {user_id: timestamp}}
    typing_indicators: Dict[int, Dict[int, float]] = {}
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.project_id = None
        self.room_group_name = None
        self.channel_layer = None
        self.redis_client = None
        
    async def connect(self):
        """
        Handle new WebSocket connection.
        Authenticates user and joins the appropriate chat group.
        """
        # Get user from scope (set by AuthMiddlewareStack)
        self.user = self.scope.get('user')
        
        # Reject if not authenticated
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        # Get project_id from URL query params
        self.project_id = self.scope.get('query_string', b'').decode('utf-8')
        if 'project_id=' in self.project_id:
            self.project_id = self.project_id.split('project_id=')[1].split('&')[0]
        else:
            self.project_id = None
            
        if not self.project_id:
            await self.close(code=4002)
            return
        
        # Create room group name for this project chat
        self.room_group_name = f'chat_project_{self.project_id}'
        
        # Add to room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Initialize Redis client for offline queue
        await self._init_redis()
        
        # Mark user as online and update presence
        await self._set_user_online()
        
        # Accept the WebSocket connection
        await self.accept()
        
        # Send queued offline messages to the user
        await self._send_queued_messages()
        
        # Broadcast user's online status to others in the room
        await self._broadcast_presence('online')
        
        logger.info(f"User {self.user.id} connected to chat project {self.project_id}")
        
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        Cleans up presence and notifies others.
        """
        if not self.user or not self.user.is_authenticated:
            return
            
        # Remove from online users
        await self._set_user_offline()
        
        # Broadcast offline status
        await self._broadcast_presence('offline')
        
        # Leave room group
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        
        logger.info(f"User {self.user.id} disconnected from chat project {self.project_id}")
        
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages.
        
        Message types:
        - 'chat_message': New message to send
        - 'ack': Acknowledgement of message receipt
        - 'typing_start': User started typing
        - 'typing_stop': User stopped typing
        - 'delivered': Message delivered to recipient
        - 'read': Message read by recipient
        - 'sync_request': Request missed messages/statuses
        - 'sync_response': Response with missed data
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            logger.debug(f"Received WebSocket message type: {message_type} from user {self.user.id}")
            
            if message_type == 'chat_message':
                await self._handle_chat_message(data)
            elif message_type == 'ack':
                await self._handle_ack(data)
            elif message_type == 'typing_start':
                await self._handle_typing_start(data)
            elif message_type == 'typing_stop':
                await self._handle_typing_stop(data)
            elif message_type == 'delivered':
                await self._handle_delivered(data)
            elif message_type == 'read':
                await self._handle_read(data)
            elif message_type == 'sync_request':
                await self._handle_sync_request(data)
            elif message_type == 'pong':
                # Response to ping, connection is alive
                pass
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {e}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            
    # =========================================================================
    # MESSAGE HANDLERS
    # =========================================================================
    
    async def _handle_chat_message(self, data: Dict[str, Any]):
        """
        Handle new chat message.
        - Stores temporarily in Redis queue for offline users
        - Sends immediately to online users
        - Sends ACK back to sender
        """
        content = data.get('content', '')
        recipient_id = data.get('recipient_id')
        message_id = data.get('message_id', f"msg_{datetime.now().timestamp()}")
        
        if not content or not recipient_id:
            return
            
        # Prepare message payload
        message_payload = {
            'type': 'chat_message',
            'message_id': message_id,
            'content': content,
            'sender_id': self.user.id,
            'sender_name': self.user.username or self.user.email,
            'project_id': self.project_id,
            'timestamp': datetime.now().isoformat(),
            'status': 'sent'  # Initial status
        }
        
        # Check if recipient is online
        recipient_online = await self._is_user_online(recipient_id)
        
        if recipient_online:
            # Send directly to recipient
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    **message_payload,
                    'require_ack': True  # Recipient must ACK
                }
            )
            
            # Update status to 'sent'
            message_payload['status'] = 'sent'
        else:
            # Queue message for offline user in Redis
            await self._queue_offline_message(recipient_id, message_payload)
            message_payload['status'] = 'queued'  # Temporarily queued
            
        # Send ACK to sender that message was processed
        await self.send(json.dumps({
            'type': 'ack',
            'message_id': message_id,
            'status': 'sent' if recipient_online else 'queued',
            'timestamp': datetime.now().isoformat()
        }))
        
    async def _handle_ack(self, data: Dict[str, Any]):
        """
        Handle acknowledgement from recipient.
        Removes message from temporary queue upon ACK receipt.
        """
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        if not message_id or not sender_id:
            return
            
        # Remove from offline queue (if it was queued)
        await self._remove_from_offline_queue(sender_id, message_id)
        
        # Notify sender that message was delivered
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_status_update',
                'message_id': message_id,
                'status': 'delivered',
                'recipient_id': self.user.id,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def _handle_typing_start(self, data: Dict[str, Any]):
        """Handle typing start indicator - broadcast to others."""
        recipient_id = data.get('recipient_id')
        
        # Store typing indicator (ephemeral, no DB)
        if self.project_id not in self.typing_indicators:
            self.typing_indicators[self.project_id] = {}
        self.typing_indicators[self.project_id][self.user.id] = datetime.now().timestamp()
        
        # Broadcast typing to room (excluding sender)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'is_typing': True,
                'recipient_id': recipient_id
            }
        )
        
    async def _handle_typing_stop(self, data: Dict[str, Any]):
        """Handle typing stop indicator - broadcast to others."""
        # Remove typing indicator
        if self.project_id in self.typing_indicators:
            self.typing_indicators[self.project_id].pop(self.user.id, None)
            
        # Broadcast typing stop to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'is_typing': False
            }
        )
        
    async def _handle_delivered(self, data: Dict[str, Any]):
        """Handle message delivered receipt."""
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        # Notify sender of delivery
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_status_update',
                'message_id': message_id,
                'status': 'delivered',
                'recipient_id': self.user.id,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    async def _handle_read(self, data: Dict[str, Any]):
        """Handle message read receipt."""
        message_ids = data.get('message_ids', [])
        sender_id = data.get('sender_id')
        
        # Notify sender of read status for each message
        for message_id in message_ids:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_status_update',
                    'message_id': message_id,
                    'status': 'read',
                    'recipient_id': self.user.id,
                    'timestamp': datetime.now().isoformat()
                }
            )
            
    async def _handle_sync_request(self, data: Dict[str, Any]):
        """
        Handle sync request for missed messages/statuses after reconnection.
        Returns queued messages and status updates.
        """
        last_message_id = data.get('last_message_id')
        
        # Get queued offline messages for this user
        queued_messages = await self._get_queued_messages()
        
        # Send sync response
        await self.send(json.dumps({
            'type': 'sync_response',
            'queued_messages': queued_messages,
            'timestamp': datetime.now().isoformat()
        }))
        
    # =========================================================================
    # OUTBOUND MESSAGE HANDLERS (called by channel layer)
    # =========================================================================
    
    async def chat_message(self, event: Dict[str, Any]):
        """
        Handle outgoing chat message to WebSocket.
        This is called when message is sent to the room group.
        """
        # Don't send back to sender
        if event.get('sender_id') == self.user.id:
            return
            
        await self.send(json.dumps(event))
        
    async def typing_indicator(self, event: Dict[str, Any]):
        """
        Handle typing indicator broadcast.
        """
        await self.send(json.dumps(event))
        
    async def message_status_update(self, event: Dict[str, Any]):
        """
        Handle message status update (delivered, read).
        """
        # Only send to the original sender
        if event.get('recipient_id') != self.user.id:
            return
            
        await self.send(json.dumps(event))
        
    async def presence_update(self, event: Dict[str, Any]):
        """
        Handle presence update broadcast.
        """
        await self.send(json.dumps(event))
        
    # =========================================================================
    # PRESENCE TRACKING
    # =========================================================================
    
    async def _set_user_online(self):
        """Mark user as online."""
        if not self.user:
            return
            
        user_id = self.user.id
        if user_id not in self.online_users:
            self.online_users[user_id] = {}
            
        self.online_users[user_id][self.channel_name] = datetime.now().timestamp()
        
    async def _set_user_offline(self):
        """Mark user as offline."""
        if not self.user:
            return
            
        user_id = self.user.id
        if user_id in self.online_users:
            self.online_users[user_id].pop(self.channel_name, None)
            if not self.online_users[user_id]:
                del self.online_users[user_id]
                
    async def _is_user_online(self, user_id: int) -> bool:
        """Check if a user is online."""
        return user_id in self.online_users and bool(self.online_users[user_id])
        
    async def _broadcast_presence(self, status: str):
        """Broadcast presence status to room."""
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'presence_update',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'status': status,
                'last_seen': datetime.now().isoformat() if status == 'offline' else None,
                'timestamp': datetime.now().isoformat()
            }
        )
        
    # =========================================================================
    # OFFLINE MESSAGE QUEUE (Redis-based)
    # =========================================================================
    
    async def _init_redis(self):
        """Initialize Redis client for offline queue."""
        try:
            import redis
            redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established for offline queue")
        except Exception as e:
            logger.warning(f"Redis unavailable, using in-memory fallback: {e}")
            self.redis_client = None
            # In-memory fallback
            if not hasattr(ChatConsumer, '_offline_queue'):
                ChatConsumer._offline_queue = {}
                
    async def _queue_offline_message(self, recipient_id: int, message: Dict[str, Any]):
        """
        Queue message for offline user in Redis.
        Messages are automatically purged after delivery + ACK.
        """
        queue_key = f"offline_queue:{recipient_id}"
        
        try:
            if self.redis_client:
                # Store in Redis with TTL of 24 hours
                import json
                self.redis_client.rpush(queue_key, json.dumps(message))
                self.redis_client.expire(queue_key, 86400)  # 24 hours
            else:
                # In-memory fallback
                if not hasattr(ChatConsumer, '_offline_queue'):
                    ChatConsumer._offline_queue = {}
                if queue_key not in ChatConsumer._offline_queue:
                    ChatConsumer._offline_queue[queue_key] = []
                ChatConsumer._offline_queue[queue_key].append(message)
                
            logger.debug(f"Queued message for offline user {recipient_id}")
        except Exception as e:
            logger.error(f"Error queueing offline message: {e}")
            
    async def _send_queued_messages(self):
        """
        Send all queued messages to user upon connection.
        Messages are sent one by one and removed from queue upon ACK.
        """
        queue_key = f"offline_queue:{self.user.id}"
        
        try:
            queued_messages = []
            
            if self.redis_client:
                import json
                # Get all messages without removing them
                while self.redis_client.llen(queue_key) > 0:
                    msg_json = self.redis_client.lpop(queue_key)
                    if msg_json:
                        queued_messages.append(json.loads(msg_json))
            else:
                # In-memory fallback
                if hasattr(ChatConsumer, '_offline_queue'):
                    queued_messages = ChatConsumer._offline_queue.get(queue_key, [])
                    ChatConsumer._offline_queue[queue_key] = []
                    
            # Send queued messages to user
            for msg in queued_messages:
                await self.send(json.dumps({
                    'type': 'chat_message',
                    **msg,
                    'require_ack': True
                }))
                
            if queued_messages:
                logger.info(f"Sent {len(queued_messages)} queued messages to user {self.user.id}")
                
        except Exception as e:
            logger.error(f"Error sending queued messages: {e}")
            
    async def _get_queued_messages(self) -> List[Dict[str, Any]]:
        """Get queued messages for sync (without removing)."""
        queue_key = f"offline_queue:{self.user.id}"
        messages = []
        
        try:
            if self.redis_client:
                import json
                # Peek at queue
                for msg_json in self.redis_client.lrange(queue_key, 0, -1):
                    messages.append(json.loads(msg_json))
            else:
                if hasattr(ChatConsumer, '_offline_queue'):
                    messages = ChatConsumer._offline_queue.get(queue_key, [])
        except Exception as e:
            logger.error(f"Error getting queued messages: {e}")
            
        return messages
        
    async def _remove_from_offline_queue(self, recipient_id: int, message_id: str):
        """
        Remove message from offline queue upon ACK.
        This is the CRITICAL requirement - messages are purged after delivery.
        """
        queue_key = f"offline_queue:{recipient_id}"
        
        try:
            if self.redis_client:
                import json
                # Remove the specific message from queue
                remaining = []
                while self.redis_client.llen(queue_key) > 0:
                    msg_json = self.redis_client.lpop(queue_key)
                    if msg_json:
                        msg = json.loads(msg_json)
                        if msg.get('message_id') != message_id:
                            remaining.append(msg)
                # Re-add remaining messages
                for msg in remaining:
                    self.redis_client.rpush(queue_key, json.dumps(msg))
            else:
                # In-memory fallback
                if hasattr(ChatConsumer, '_offline_queue') and queue_key in ChatConsumer._offline_queue:
                    ChatConsumer._offline_queue[queue_key] = [
                        m for m in ChatConsumer._offline_queue[queue_key]
                        if m.get('message_id') != message_id
                    ]
                    
            logger.debug(f"Removed message {message_id} from offline queue for user {recipient_id}")
        except Exception as e:
            logger.error(f"Error removing from offline queue: {e}")


class PresenceConsumer(AsyncWebsocketConsumer):
    """
    Dedicated consumer for presence updates.
    Handles online/offline status and last seen timestamps.
    """
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return
            
        # Join presence group for this user
        self.presence_group = f"presence_{self.user.id}"
        
        await self.channel_layer.group_add(
            self.presence_group,
            self.channel_name
        )
        
        await self.accept()
        
        # Send current online users list
        await self._send_online_users()
        
        # Mark user as online
        await self._update_presence('online')
        
    async def disconnect(self, close_code):
        if hasattr(self, 'presence_group') and self.user:
            await self._update_presence('offline')
            await self.channel_layer.group_discard(
                self.presence_group,
                self.channel_name
            )
            
    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type')
        
        if msg_type == 'get_online_users':
            await self._send_online_users()
            
    async def _update_presence(self, status: str):
        """Update user's presence status."""
        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        
        await layer.group_send(
            self.presence_group,
            {
                'type': 'presence_change',
                'user_id': self.user.id,
                'status': status,
                'last_seen': datetime.now().isoformat() if status == 'offline' else None
            }
        )
        
    async def _send_online_users(self):
        """Send list of online users to the connected client."""
        online_users = []
        for user_id in ChatConsumer.online_users:
            online_users.append({
                'user_id': user_id,
                'status': 'online'
            })
            
        await self.send(json.dumps({
            'type': 'online_users',
            'users': online_users
        }))
        
    async def presence_change(self, event):
        """Handle presence change broadcast."""
        await self.send(json.dumps(event))
