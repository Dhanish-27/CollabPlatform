"""
WebSocket Consumer for Real-Time Group Chat
============================================
Architecture (WhatsApp-style):
  1. Messages are NEVER permanently stored in the main DB.
  2. When a message is sent:
     - It is broadcast to ALL currently-online group members immediately.
     - For each OFFLINE member a PendingMessage row is created.
  3. When a client connects it fetches its PendingMessage rows and receives them.
  4. The client sends an ACK for each received message.
  5. On ACK the PendingMessage row is DELETED.
  6. Typing indicators and presence are ephemeral (no DB).

JWT Authentication:
  The JWT token must be passed as a query-string parameter:
    ws://host/ws/chat/?project_id=<id>&token=<jwt>
  The JwtAuthMiddlewareStack in asgi.py sets scope['user'] before this consumer runs.
"""

import json
import logging
from datetime import datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB helpers (run in thread pool via database_sync_to_async)
# ---------------------------------------------------------------------------

@database_sync_to_async
def get_project_member_ids(project_id):
    """Return a list of user IDs that are members of the project."""
    from apps.projects.models import ProjectMember
    return list(
        ProjectMember.objects.filter(project_id=project_id)
        .values_list('user_id', flat=True)
    )


@database_sync_to_async
def create_pending_message(recipient_id, sender_id, project_id, message_id, content):
    """Persist a PendingMessage for an offline member."""
    from .models import PendingMessage
    PendingMessage.objects.get_or_create(
        message_id=message_id,
        recipient_id=recipient_id,
        defaults={
            'sender_id': sender_id,
            'project_id': project_id,
            'content': content,
        }
    )


@database_sync_to_async
def get_pending_messages(recipient_id, project_id):
    """Fetch all pending messages for a user in a project."""
    from .models import PendingMessage
    msgs = PendingMessage.objects.filter(
        recipient_id=recipient_id,
        project_id=project_id
    ).select_related('sender').order_by('created_at')
    return [
        {
            'message_id': m.message_id,
            'content': m.content,
            'sender_id': m.sender_id,
            'sender_name': m.sender.username or m.sender.email,
            'timestamp': m.created_at.isoformat(),
            'require_ack': True,
        }
        for m in msgs
    ]


@database_sync_to_async
def delete_pending_message(message_id, recipient_id):
    """Delete a PendingMessage after the recipient ACKs it."""
    from .models import PendingMessage
    PendingMessage.objects.filter(
        message_id=message_id,
        recipient_id=recipient_id
    ).delete()


# ---------------------------------------------------------------------------
# Presence tracking (in-memory, per-process)
# Format: { project_id: set(user_id) }
# ---------------------------------------------------------------------------
_online_users: dict = {}


def _mark_online(project_id, user_id):
    _online_users.setdefault(project_id, set()).add(user_id)


def _mark_offline(project_id, user_id):
    if project_id in _online_users:
        _online_users[project_id].discard(user_id)


def _is_online(project_id, user_id):
    return user_id in _online_users.get(project_id, set())


def _get_online_set(project_id):
    return set(_online_users.get(project_id, set()))


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------

class ChatConsumer(AsyncWebsocketConsumer):
    """
    Async WebSocket consumer for group project chat.

    URL: /ws/chat/?project_id=<id>&token=<jwt>
    """

    async def connect(self):
        self.user = self.scope.get('user')

        # Reject unauthenticated connections
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        # Parse project_id from query string
        qs = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=') for p in qs.split('&') if '=' in p)
        self.project_id = params.get('project_id')

        if not self.project_id:
            await self.close(code=4002)
            return

        self.room_group_name = f'chat_project_{self.project_id}'

        # Join channel group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        # Mark online
        _mark_online(self.project_id, self.user.id)

        # Accept connection
        await self.accept()

        # Deliver any pending (offline-queued) messages
        pending = await get_pending_messages(self.user.id, self.project_id)
        for msg in pending:
            await self.send(json.dumps({'type': 'chat_message', **msg}))

        # Broadcast presence to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'presence_update',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'status': 'online',
                'last_seen': None,
            }
        )

        logger.info(f"User {self.user.id} connected to project {self.project_id}")

    async def disconnect(self, close_code):
        if not getattr(self, 'user', None) or not self.user.is_authenticated:
            return

        _mark_offline(self.project_id, self.user.id)

        # Broadcast offline presence
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'presence_update',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'status': 'offline',
                'last_seen': datetime.utcnow().isoformat(),
            }
        )

        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        logger.info(f"User {self.user.id} disconnected from project {self.project_id}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type')

        if msg_type == 'chat_message':
            await self._handle_chat_message(data)
        elif msg_type == 'ack':
            await self._handle_ack(data)
        elif msg_type == 'typing_start':
            await self._handle_typing(data, is_typing=True)
        elif msg_type == 'typing_stop':
            await self._handle_typing(data, is_typing=False)
        elif msg_type == 'delivered':
            await self._handle_status_update(data, 'delivered')
        elif msg_type == 'read':
            await self._handle_status_update(data, 'read')
        elif msg_type == 'pong':
            pass  # keep-alive
        else:
            logger.debug(f"Unknown WS message type: {msg_type}")

    # -----------------------------------------------------------------------
    # Handlers
    # -----------------------------------------------------------------------

    async def _handle_chat_message(self, data):
        content = data.get('content', '').strip()
        message_id = data.get('message_id') or f"msg_{datetime.utcnow().timestamp()}"

        if not content:
            return

        timestamp = datetime.utcnow().isoformat()
        sender_name = self.user.username or self.user.email

        # Get all project member IDs
        member_ids = await get_project_member_ids(self.project_id)

        online_now = _get_online_set(self.project_id)

        # Broadcast to all online members (including sender so they get confirmation)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_id': message_id,
                'content': content,
                'sender_id': self.user.id,
                'sender_name': sender_name,
                'project_id': self.project_id,
                'timestamp': timestamp,
                'require_ack': False,  # live delivery — no ACK needed
            }
        )

        # Queue for offline members
        for uid in member_ids:
            if uid != self.user.id and uid not in online_now:
                await create_pending_message(
                    recipient_id=uid,
                    sender_id=self.user.id,
                    project_id=self.project_id,
                    message_id=message_id,
                    content=content,
                )

        # Send ACK back to sender confirming server processed the message
        await self.send(json.dumps({
            'type': 'ack',
            'message_id': message_id,
            'status': 'sent',
            'timestamp': timestamp,
        }))

    async def _handle_ack(self, data):
        """Client ACKs a pending message — delete it from DB."""
        message_id = data.get('message_id')
        if not message_id:
            return
        await delete_pending_message(message_id, self.user.id)

        # Notify sender that message was delivered
        sender_id = data.get('sender_id')
        if sender_id:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'message_status_update',
                    'message_id': message_id,
                    'status': 'delivered',
                    'recipient_id': self.user.id,
                    'timestamp': datetime.utcnow().isoformat(),
                }
            )

    async def _handle_typing(self, data, is_typing: bool):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'is_typing': is_typing,
            }
        )

    async def _handle_status_update(self, data, status: str):
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        if not message_id:
            return
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_status_update',
                'message_id': message_id,
                'status': status,
                'recipient_id': self.user.id,
                'timestamp': datetime.utcnow().isoformat(),
            }
        )

    # -----------------------------------------------------------------------
    # Channel layer event handlers (called by group_send)
    # -----------------------------------------------------------------------

    async def chat_message(self, event):
        """Forward chat_message event to WebSocket client."""
        await self.send(json.dumps({
            'type': 'chat_message',
            'message_id': event['message_id'],
            'content': event['content'],
            'sender_id': event['sender_id'],
            'sender_name': event['sender_name'],
            'project_id': event['project_id'],
            'timestamp': event['timestamp'],
            'require_ack': event.get('require_ack', False),
        }))

    async def message_status_update(self, event):
        """Forward status update to WebSocket client."""
        await self.send(json.dumps({
            'type': 'message_status_update',
            'message_id': event['message_id'],
            'status': event['status'],
            'recipient_id': event['recipient_id'],
            'timestamp': event['timestamp'],
        }))

    async def typing_indicator(self, event):
        """Forward typing indicator — skip if it's the sender themselves."""
        if event['user_id'] == self.user.id:
            return
        await self.send(json.dumps({
            'type': 'typing_indicator',
            'user_id': event['user_id'],
            'user_name': event['user_name'],
            'is_typing': event['is_typing'],
        }))

    async def presence_update(self, event):
        """Forward presence update to WebSocket client."""
        await self.send(json.dumps({
            'type': 'presence_update',
            'user_id': event['user_id'],
            'user_name': event['user_name'],
            'status': event['status'],
            'last_seen': event.get('last_seen'),
        }))


# ---------------------------------------------------------------------------
# Presence-only consumer (lightweight, for dashboard online indicators)
# ---------------------------------------------------------------------------

class PresenceConsumer(AsyncWebsocketConsumer):
    """Lightweight consumer for global online/offline presence tracking."""

    async def connect(self):
        self.user = self.scope.get('user')
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        self.presence_group = 'presence_global'
        await self.channel_layer.group_add(self.presence_group, self.channel_name)
        await self.accept()

        # Announce online
        await self.channel_layer.group_send(
            self.presence_group,
            {
                'type': 'presence_update',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'status': 'online',
                'last_seen': None,
            }
        )

    async def disconnect(self, close_code):
        if not getattr(self, 'user', None) or not self.user.is_authenticated:
            return
        await self.channel_layer.group_send(
            self.presence_group,
            {
                'type': 'presence_update',
                'user_id': self.user.id,
                'user_name': self.user.username or self.user.email,
                'status': 'offline',
                'last_seen': datetime.utcnow().isoformat(),
            }
        )
        await self.channel_layer.group_discard(self.presence_group, self.channel_name)

    async def presence_update(self, event):
        await self.send(json.dumps(event))
