/**
 * useChatWebSocket Hook
 * =====================
 * Custom React hook for WebSocket communication with:
 * - Exponential backoff reconnection
 * - Message status tracking
 * - Presence indicators
 * - Typing indicators
 * - Automatic sync on reconnection
 * 
 * CRITICAL: This hook manages ephemeral real-time communication.
 * Messages are stored locally in IndexedDB, NOT permanently on backend.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    saveMessage,
    getMessages,
    updateMessageStatus,
    savePendingAck,
    removePendingAck,
    getPendingAckMessages,
    getMessagesAfter
} from '../services/indexedDB';

// Helper to get token from localStorage
const getStoredToken = () => localStorage.getItem('token');

// WebSocket configuration
const WS_CONFIG = {
    // Reconnection settings
    RECONNECT_BASE_DELAY: 1000,    // Start with 1 second
    RECONNECT_MAX_DELAY: 30000,     // Max 30 seconds
    RECONNECT_MULTIPLIER: 2,        // Exponential backoff

    // Ping/pong for connection health
    PING_INTERVAL: 30000,            // 30 seconds
    PONG_TIMEOUT: 5000,             // Wait 5 seconds for pong

    // Typing indicator debounce
    TYPING_DEBOUNCE: 1000,
};

/**
 * Custom hook for WebSocket chat functionality
 * @param {string} projectId - The project/conversation ID
 * @param {Object} user - Current user object
 * @returns {Object} WebSocket state and methods
 */
export const useChatWebSocket = (projectId, user) => {
    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

    // Message state
    const [messages, setMessages] = useState([]);
    const [pendingMessages, setPendingMessages] = useState([]);

    // Presence state
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [userPresence, setUserPresence] = useState({}); // { userId: { status, lastSeen } }

    // Typing state
    const [typingUsers, setTypingUsers] = useState(new Map()); // { userId: { name, timestamp } }

    // Refs for WebSocket and timers
    const wsRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const pingIntervalRef = useRef(null);
    const pongTimeoutRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);
    const lastSyncTimeRef = useRef(null);

    // =========================================================================
    // WEBSOCKET CONNECTION
    // =========================================================================

    /**
     * Establish WebSocket connection with authentication
     */
    const connect = useCallback(async () => {
        if (!projectId || !user?.id) return;

        // Prevent multiple connection attempts
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        setConnectionStatus('connecting');

        try {
            // Get JWT token for authentication
            const token = getStoredToken();

            if (!token) {
                console.error('No auth token available');
                setConnectionStatus('disconnected');
                return;
            }

            // Build WebSocket URL — JWT token passed as query param for Channels auth
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // Bypass React proxy in dev to avoid dropped WS headers (causing Daphne Hixie76 error)
            const host = process.env.NODE_ENV === 'development' ? '127.0.0.1:8000' : window.location.host;
            const wsUrl = `${wsProtocol}//${host}/ws/chat/?project_id=${projectId}&token=${token}`;

            const ws = new WebSocket(wsUrl);
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttemptRef.current = 0;

                // Start ping interval (uses wsRef directly, not isConnected state)
                startPingInterval();

                // Resend any locally-pending messages (uses wsRef directly)
                resendPendingMessages();
                // Note: pending messages from the server are delivered automatically
                // by the consumer on connect — no sync_request needed.
            };

            ws.onmessage = (event) => {
                handleMessage(event);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                setIsConnected(false);
                setConnectionStatus('disconnected');

                // Clear ping interval
                clearPingInterval();

                // Attempt reconnection if not a clean close
                if (event.code !== 1000) {
                    scheduleReconnect();
                }
            };

            wsRef.current = ws;

        } catch (error) {
            console.error('Failed to connect:', error);
            setConnectionStatus('disconnected');
            scheduleReconnect();
        }
    }, [projectId, user]);

    /**
     * Disconnect WebSocket
     */
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        clearPingInterval();

        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnect');
            wsRef.current = null;
        }

        setIsConnected(false);
        setConnectionStatus('disconnected');
    }, []);

    /**
     * Schedule reconnection with exponential backoff
     */
    const scheduleReconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) return;

        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(
            WS_CONFIG.RECONNECT_BASE_DELAY * Math.pow(WS_CONFIG.RECONNECT_MULTIPLIER, attempt),
            WS_CONFIG.RECONNECT_MAX_DELAY
        );

        console.log(`Scheduling reconnect in ${delay}ms (attempt ${attempt + 1})`);
        setConnectionStatus('reconnecting');

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            reconnectAttemptRef.current++;
            connect();
        }, delay);
    }, [connect]);

    // =========================================================================
    // MESSAGE HANDLING
    // =========================================================================

    /**
     * Handle incoming WebSocket messages
     */
    const handleMessage = useCallback(async (event) => {
        try {
            const data = typeof event.data === 'string'
                ? JSON.parse(event.data)
                : JSON.parse(new TextDecoder().decode(event.data));

            const { type, ...payload } = data;

            switch (type) {
                case 'chat_message':
                    await handleChatMessage(payload);
                    break;

                case 'ack':
                    await handleAck(payload);
                    break;

                case 'typing_indicator':
                    handleTypingIndicator(payload);
                    break;

                case 'message_status_update':
                    await handleStatusUpdate(payload);
                    break;

                case 'presence_update':
                    handlePresenceUpdate(payload);
                    break;

                case 'sync_response':
                    await handleSyncResponse(payload);
                    break;

                case 'pong':
                    handlePong();
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }, []);

    /**
     * Handle incoming chat message
     */
    const handleChatMessage = async (payload) => {
        const { db_id, message_id, content, sender_id, sender_name, timestamp, require_ack } = payload;

        // Create message object
        const message = {
            id: message_id,
            db_id: db_id || null,
            localId: message_id,
            content,
            senderId: sender_id,
            senderName: sender_name,
            conversationId: projectId,
            timestamp: timestamp || new Date().toISOString(),
            status: 'delivered', // Received and displayed
            isIncoming: sender_id !== user.id
        };

        // Save to IndexedDB
        await saveMessage(message);

        // Update local state
        setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === message.id)) {
                return prev;
            }
            return [...prev, message];
        });

        // Send ACK if required (for offline queue messages)
        if (require_ack) {
            sendAck(message_id, sender_id);
        }

        // If message is from another user, send delivered receipt
        if (sender_id !== user.id) {
            sendDeliveredReceipt(message_id, sender_id);
        }
    };

    /**
     * Handle acknowledgement from server
     */
    const handleAck = async (payload) => {
        const { message_id, status } = payload;

        // Update message status in IndexedDB
        await updateMessageStatus(message_id, status);

        // Remove from pending
        await removePendingAck(message_id);

        // Update local state
        setMessages(prev => prev.map(m =>
            m.id === message_id ? { ...m, status } : m
        ));

        setPendingMessages(prev => prev.filter(m => m.id !== message_id));
    };

    /**
     * Handle message status update (delivered, read)
     */
    const handleStatusUpdate = async (payload) => {
        const { message_id, status, recipient_id } = payload;

        // Only update if this is for a message we sent
        if (recipient_id !== user.id) return;

        // Update in IndexedDB
        await updateMessageStatus(message_id, status);

        // Update local state
        setMessages(prev => prev.map(m =>
            m.id === message_id ? { ...m, status } : m
        ));
    };

    /**
     * Handle typing indicator
     */
    const handleTypingIndicator = (payload) => {
        const { user_id, user_name, is_typing: isTyping } = payload;

        // Don't show our own typing indicator
        if (user_id === user.id) return;

        setTypingUsers(prev => {
            const newMap = new Map(prev);

            if (isTyping) {
                newMap.set(user_id, {
                    name: user_name,
                    timestamp: Date.now()
                });
            } else {
                newMap.delete(user_id);
            }

            return newMap;
        });

        // Auto-clear typing indicator after timeout
        if (isTyping) {
            setTimeout(() => {
                setTypingUsers(prev => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(user_id);
                    if (existing && Date.now() - existing.timestamp > 5000) {
                        newMap.delete(user_id);
                    }
                    return newMap;
                });
            }, 5000);
        }
    };

    /**
     * Handle presence update
     */
    const handlePresenceUpdate = (payload) => {
        const { user_id, status, last_seen, user_name } = payload;

        setUserPresence(prev => ({
            ...prev,
            [user_id]: {
                status,
                lastSeen: last_seen,
                userName: user_name
            }
        }));

        setOnlineUsers(prev => {
            const newSet = new Set(prev);
            if (status === 'online') {
                newSet.add(user_id);
            } else {
                newSet.delete(user_id);
            }
            return newSet;
        });
    };

    /**
     * Handle sync response (after reconnection)
     */
    const handleSyncResponse = async (payload) => {
        const { queued_messages, timestamp } = payload;

        lastSyncTimeRef.current = timestamp;

        // Save queued messages
        for (const msg of queued_messages) {
            await saveMessage({
                ...msg,
                conversationId: projectId,
                isIncoming: msg.sender_id !== user.id
            });
        }

        // Reload messages from IndexedDB
        const allMessages = await getMessages(projectId);
        setMessages(allMessages);
    };

    // =========================================================================
    // OUTGOING MESSAGES
    // =========================================================================

    /**
     * Send a chat message
     */
    const sendMessage = useCallback(async (content, recipientId) => {
        if (!content.trim() || !isConnected) return null;

        // Generate local ID for the message
        const localId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create message object
        const message = {
            id: localId,
            localId,
            content: content.trim(),
            senderId: user.id,
            senderName: user.username || user.email,
            conversationId: projectId,
            recipientId,
            timestamp: new Date().toISOString(),
            status: 'pending',
            isIncoming: false
        };

        // Save to IndexedDB with pending status
        await saveMessage(message);
        await savePendingAck(message);

        // Update local state
        setMessages(prev => [...prev, message]);
        setPendingMessages(prev => [...prev, message]);

        // Send via WebSocket
        wsRef.current.send(JSON.stringify({
            type: 'chat_message',
            message_id: localId,
            content: content.trim(),
            recipient_id: recipientId
        }));

        return localId;
    }, [projectId, user, isConnected]);

    /**
     * Send acknowledgement for received message
     */
    const sendAck = useCallback((messageId, senderId) => {
        if (!isConnected) return;

        wsRef.current.send(JSON.stringify({
            type: 'ack',
            message_id: messageId,
            sender_id: senderId
        }));
    }, [isConnected]);

    /**
     * Send delivered receipt
     */
    const sendDeliveredReceipt = useCallback((messageId, senderId) => {
        if (!isConnected) return;

        wsRef.current.send(JSON.stringify({
            type: 'delivered',
            message_id: messageId,
            sender_id: senderId
        }));
    }, [isConnected]);

    /**
     * Send read receipt
     */
    const sendReadReceipt = useCallback((messageIds, senderId) => {
        if (!isConnected) return;

        wsRef.current.send(JSON.stringify({
            type: 'read',
            message_ids: messageIds,
            sender_id: senderId
        }));
    }, [isConnected]);

    /**
     * Mark messages as read and send receipt
     */
    const markMessagesAsRead = useCallback((messageIds, senderId) => {
        // Update locally
        messageIds.forEach(async (id) => {
            await updateMessageStatus(id, 'read');
        });

        setMessages(prev => prev.map(m =>
            messageIds.includes(m.id) ? { ...m, status: 'read' } : m
        ));

        // Send read receipt
        sendReadReceipt(messageIds, senderId);
    }, [sendReadReceipt]);

    // =========================================================================
    // TYPING INDICATORS
    // =========================================================================

    /**
     * Send typing start indicator
     */
    const sendTypingStart = useCallback((recipientId) => {
        if (!isConnected || isTypingRef.current) return;

        isTypingRef.current = true;

        wsRef.current.send(JSON.stringify({
            type: 'typing_start',
            recipient_id: recipientId
        }));
    }, [isConnected]);

    /**
     * Send typing stop indicator
     */
    const sendTypingStop = useCallback((recipientId) => {
        if (!isConnected || !isTypingRef.current) return;

        isTypingRef.current = false;

        wsRef.current.send(JSON.stringify({
            type: 'typing_stop',
            recipient_id: recipientId
        }));
    }, [isConnected]);

    /**
     * Handle input change with typing indicators
     */
    const handleTyping = useCallback((recipientId) => {
        sendTypingStart(recipientId);

        // Debounce typing stop
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            sendTypingStop(recipientId);
        }, WS_CONFIG.TYPING_DEBOUNCE);
    }, [sendTypingStart, sendTypingStop]);

    // =========================================================================
    // SYNC & RECONNECTION
    // =========================================================================

    /**
     * Request missed messages after reconnection
     */
    const requestSync = useCallback(() => {
        if (!isConnected) return;

        wsRef.current.send(JSON.stringify({
            type: 'sync_request',
            last_message_id: lastSyncTimeRef.current
        }));
    }, [isConnected]);

    /**
     * Resend pending messages that weren't acknowledged
     */
    const resendPendingMessages = useCallback(async () => {
        const pending = await getPendingAckMessages();

        for (const { message } of pending) {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'chat_message',
                    message_id: message.id,
                    content: message.content,
                    recipient_id: message.recipientId
                }));
            }
        }
    }, []);

    // =========================================================================
    // PING/PONG (Connection Health)
    // =========================================================================

    /**
     * Start ping interval
     */
    const startPingInterval = useCallback(() => {
        pingIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'ping' }));

                // Set pong timeout
                pongTimeoutRef.current = setTimeout(() => {
                    console.log('Pong timeout, reconnecting...');
                    disconnect();
                    connect();
                }, WS_CONFIG.PONG_TIMEOUT);
            }
        }, WS_CONFIG.PING_INTERVAL);
    }, [connect, disconnect]);

    /**
     * Clear ping interval
     */
    const clearPingInterval = useCallback(() => {
        if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
            pingIntervalRef.current = null;
        }
        if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
        }
    }, []);

    /**
     * Handle pong response
     */
    const handlePong = useCallback(() => {
        if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
        }
    }, []);

    // =========================================================================
    // LOAD MESSAGES
    // =========================================================================

    /**
     * Load messages from IndexedDB
     */
    const loadMessages = useCallback(async () => {
        if (!projectId) return;

        try {
            const storedMessages = await getMessages(projectId);
            setMessages(storedMessages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }, [projectId]);

    // =========================================================================
    // EFFECTS
    // =========================================================================

    // Connect on mount
    useEffect(() => {
        if (projectId && user?.id) {
            loadMessages();
            connect();
        }

        return () => {
            disconnect();
        };
    }, [projectId, user?.id]);

    // Cleanup typing timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    // =========================================================================
    // RETURN
    // =========================================================================

    return {
        // Connection state
        isConnected,
        connectionStatus,

        // Messages
        messages,
        pendingMessages,
        sendMessage,

        // Presence
        onlineUsers,
        userPresence,

        // Typing
        typingUsers,
        handleTyping,

        // Read receipts
        markMessagesAsRead,

        // Reconnection
        connect,
        disconnect,
        requestSync,

        // Refresh
        loadMessages
    };
};

export default useChatWebSocket;
