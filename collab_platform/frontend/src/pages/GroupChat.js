/**
 * GroupChat Component - WhatsApp-style Real-Time Chat
 * ===================================================
 * Features:
 * - Real-time WebSocket messaging
 * - Message status tracking (pending → sent → delivered → read)
 * - Online/Offline presence indicators
 * - Typing indicators
 * - Local message storage with IndexedDB
 * - Robust reconnection with sync
 * 
 * CRITICAL: Messages are NOT permanently stored on backend.
 * All messages stored locally in IndexedDB.
 */

import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import GroupInfoPanel from './GroupInfoPanel';
import useChatWebSocket from '../hooks/useChatWebSocket';
import {
    FaArrowLeft,
    FaSearch,
    FaEllipsisV,
    FaPaperclip,
    FaSmile,
    FaMicrophone,
    FaPaperPlane,
    FaCheck,
    FaCheckDouble,
    FaCircle,
    FaCamera,
    FaPhone,
    FaVideo,
    FaInfoCircle,
    FaArrowDown,
    FaWifi,
    FaExclamationTriangle
} from 'react-icons/fa';
import './GroupChat.css';

/**
 * Format timestamp for message display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted time (e.g., "10:30 AM")
 */
const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format date for date dividers
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
};

/**
 * Determine if date divider should be shown
 * @param {Object} currentMsg - Current message
 * @param {Object} prevMsg - Previous message
 * @returns {boolean}
 */
const shouldShowDate = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.timestamp || currentMsg.created_at).toDateString();
    const prevDate = new Date(prevMsg.timestamp || prevMsg.created_at).toDateString();
    return currentDate !== prevDate;
};

/**
 * Get status icon based on message status
 * @param {string} status - Message status
 * @returns {JSX.Element} Icon component
 */
const StatusIcon = ({ status }) => {
    switch (status) {
        case 'pending':
            return <FaCheck className="wp-status-icon wp-pending" />;
        case 'sent':
            return <FaCheck className="wp-status-icon wp-sent" />;
        case 'delivered':
            return <FaCheckDouble className="wp-status-icon wp-delivered" />;
        case 'read':
            return <FaCheckDouble className="wp-status-icon wp-read" />;
        case 'queued':
            return <FaCheck className="wp-status-icon wp-queued" />;
        default:
            return null;
    }
};

/**
 * Get connection status display
 * @param {string} status - Connection status
 * @returns {JSX.Element|null}
 */
const ConnectionStatus = ({ status }) => {
    if (status === 'connected') return null;

    const statusConfig = {
        connecting: { text: 'Connecting to chat…', className: 'ws-toast-connecting' },
        reconnecting: { text: 'Reconnecting…', className: 'ws-toast-reconnecting' },
        disconnected: { text: 'You are offline', className: 'ws-toast-disconnected' },
    };

    const config = statusConfig[status];
    if (!config) return null;

    return (
        <div className={`ws-toast ${config.className}`}>
            <span className="ws-toast-dot" />
            <span>{config.text}</span>
        </div>
    );
};

const GroupChat = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    // Group/project state
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showInfoPanel, setShowInfoPanel] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Message input state
    const [newMessage, setNewMessage] = useState('');

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const messageListRef = useRef(null);

    // Use WebSocket hook
    const {
        isConnected,
        connectionStatus,
        messages,
        typingUsers,
        onlineUsers,
        userPresence,
        sendMessage,
        handleTyping,
        markMessagesAsRead,
        loadMessages
    } = useChatWebSocket(group?.id?.toString(), user);

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    useEffect(() => {
        fetchGroupAndMessages();
    }, [id]);

    const fetchGroupAndMessages = async () => {
        if (!id) {
            navigate('/groups');
            return;
        }

        try {
            // First fetch the group to get the project ID
            const groupRes = await axios.get(`/api/projects/${id}/`);
            setGroup(groupRes.data);

            // Messages are loaded via WebSocket hook
            // This fetches from IndexedDB
        } catch (error) {
            console.error('Error fetching group:', error);
            navigate('/groups');
        } finally {
            setLoading(false);
        }
    };

    // =========================================================================
    // SCROLL & UI
    // =========================================================================

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Mark incoming messages as read when scrolled into view
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const messageElement = entry.target;
                        const messageId = messageElement.dataset.messageId;
                        const senderId = messageElement.dataset.senderId;

                        // Mark as read if from another user and not already read
                        const message = messages.find(m => m.id === messageId);
                        if (message && message.senderId !== user?.id && message.status !== 'read') {
                            // Get all unread messages from this sender
                            const unreadFromSender = messages
                                .filter(m => m.senderId === senderId && m.status !== 'read')
                                .map(m => m.id);

                            if (unreadFromSender.length > 0) {
                                markMessagesAsRead(unreadFromSender, senderId);
                            }
                        }
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (messageListRef.current) {
            const messageElements = messageListRef.current.querySelectorAll('.wp-message-incoming');
            messageElements.forEach(el => observer.observe(el));
        }

        return () => observer.disconnect();
    }, [messages, user?.id, markMessagesAsRead]);

    // =========================================================================
    // MESSAGE HANDLING
    // =========================================================================

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !isConnected) return;

        // Determine recipient (for 1-on-1 chat, it's the other project member)
        const recipientId = group?.members?.find(m => m.id !== user?.id)?.id;

        // Send via WebSocket
        await sendMessage(newMessage, recipientId);

        setNewMessage('');

        // Stop typing indicator
        if (recipientId) {
            handleTyping(null); // Stop typing
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(e);
        }
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Send typing indicator
        const recipientId = group?.members?.find(m => m.id !== user?.id)?.id;
        if (recipientId && e.target.value) {
            handleTyping(recipientId);
        }
    };

    // =========================================================================
    // PRESENCE & TYPING DISPLAY
    // =========================================================================

    // Get other user for 1-on-1 chat
    const otherUser = group?.members?.find(m => m.id !== user?.id);

    // Check if other user is online
    const isOtherUserOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

    // Get typing user (excluding self)
    const activeTypingUser = Array.from(typingUsers.entries())
        .find(([id]) => id !== user?.id);

    // Format presence text
    const getPresenceText = () => {
        if (!otherUser) return '';

        const presence = userPresence[otherUser.id];

        if (isOtherUserOnline) {
            return 'online';
        } else if (presence?.lastSeen) {
            return `last seen ${formatTime(presence.lastSeen)}`;
        }
        return 'offline';
    };

    // =========================================================================
    // RENDER
    // =========================================================================

    if (loading) {
        return (
            <div className="wp-container">
                <div className="wp-loading">
                    <div className="wp-spinner"></div>
                    <p>Loading chat...</p>
                </div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="wp-container">
                <div className="wp-chat-error">
                    <p>Group not found</p>
                    <button onClick={() => navigate('/groups')}>Go back to groups</button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Connection Status — centered popup toast, not in sidebar */}
            <ConnectionStatus status={connectionStatus} />

            <div className="wp-container">
                {/* Sidebar - Chat List */}
                <div className="wp-sidebar wp-chat-sidebar">
                    {/* Sidebar Header */}
                    <div className="wp-sidebar-header">
                        <div className="wp-sidebar-header-row">
                            <button className="wp-back-btn" onClick={() => navigate('/groups')}>
                                <FaArrowLeft />
                            </button>
                            <h2>Chats</h2>
                        </div>
                        <div className="wp-search-container">
                            <FaSearch className="wp-search-icon" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                className="wp-search-input"
                            />
                        </div>
                    </div>

                    {/* Chat List */}
                    <div className="wp-chats-list">
                        <div className="wp-chat-item wp-chat-item-active">
                            <div className="wp-chat-avatar">
                                {group.image ? (
                                    <img src={group.image} alt={group.title} />
                                ) : (
                                    <div className="wp-avatar-placeholder">
                                        {group.title.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {/* Online indicator */}
                                {isOtherUserOnline && (
                                    <div className="wp-online-indicator"></div>
                                )}
                            </div>
                            <div className="wp-chat-info">
                                <div className="wp-chat-header-row">
                                    <h3 className="wp-chat-name">{group.title}</h3>
                                </div>
                                <p className="wp-chat-preview">
                                    {activeTypingUser
                                        ? `${activeTypingUser[1].name} is typing...`
                                        : group.members_count
                                            ? `${group.members_count} members`
                                            : 'Click to chat'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="wp-main-area wp-chat-main">
                    {/* Chat Header */}
                    <div className="wp-chat-header">
                        <div className="wp-chat-header-left" onClick={() => setShowInfoPanel(true)}>
                            <div className="wp-chat-avatar">
                                {group.image ? (
                                    <img src={group.image} alt={group.title} />
                                ) : (
                                    <div className="wp-avatar-placeholder">
                                        {group.title.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                {/* Online indicator */}
                                {isOtherUserOnline && (
                                    <div className="wp-online-indicator"></div>
                                )}
                            </div>
                            <div className="wp-chat-header-info">
                                <h3 className="wp-chat-title">{group.title}</h3>
                                <p className="wp-chat-subtitle">
                                    {activeTypingUser
                                        ? 'typing...'
                                        : getPresenceText() || (group.members_count ? `${group.members_count} members` : 'Click for group info')
                                    }
                                </p>
                            </div>
                        </div>
                        <div className="wp-chat-header-actions">
                            <button className="wp-header-btn" title="Voice call">
                                <FaPhone />
                            </button>
                            <button className="wp-header-btn" title="Video call">
                                <FaVideo />
                            </button>
                            <button
                                className="wp-header-btn"
                                title="Search"
                                onClick={() => setShowInfoPanel(true)}
                            >
                                <FaSearch />
                            </button>
                            <button
                                className="wp-header-btn"
                                title="More options"
                                onClick={() => setShowInfoPanel(!showInfoPanel)}
                            >
                                <FaEllipsisV />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="wp-messages-container" ref={messageListRef}>
                        {/* Chat Background Pattern */}
                        <div className="wp-chat-background"></div>

                        <div className="wp-messages-list">
                            {/* Welcome Message */}
                            <div className="wp-message wp-message-welcome">
                                <div className="wp-message-content wp-welcome-content">
                                    <FaInfoCircle className="wp-welcome-icon" />
                                    <p>Messages are end-to-end encrypted. No one outside of this group can read them.</p>
                                </div>
                            </div>

                            {messages.map((message, index) => {
                                const isOwnMessage = message.senderId === user?.id || message.author?.id === user?.id;
                                const showDate = shouldShowDate(message, messages[index - 1]);

                                return (
                                    <React.Fragment key={message.id || index}>
                                        {showDate && (
                                            <div className="wp-date-divider">
                                                <span>{formatDate(message.timestamp || message.created_at)}</span>
                                            </div>
                                        )}
                                        <div
                                            className={`wp-message ${isOwnMessage ? 'wp-message-outgoing' : 'wp-message-incoming'}`}
                                            data-message-id={message.id}
                                            data-sender-id={message.senderId || message.author?.id}
                                        >
                                            <div className="wp-message-bubble">
                                                {!isOwnMessage && (
                                                    <div className="wp-message-sender">
                                                        {message.senderName || message.author?.username || message.author?.email || 'Unknown'}
                                                    </div>
                                                )}
                                                <div className="wp-message-text">{message.content}</div>
                                                <div className="wp-message-meta">
                                                    <span className="wp-message-time">
                                                        {formatTime(message.timestamp || message.created_at)}
                                                    </span>
                                                    {isOwnMessage && (
                                                        <span className="wp-message-status">
                                                            <StatusIcon status={message.status} />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}

                            {/* Typing indicator */}
                            {activeTypingUser && (
                                <div className="wp-message wp-message-incoming wp-typing-message">
                                    <div className="wp-message-bubble wp-typing-bubble">
                                        <span className="wp-typing-dot"></span>
                                        <span className="wp-typing-dot"></span>
                                        <span className="wp-typing-dot"></span>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Message Input */}
                    <div className="wp-message-input-container">
                        <button
                            className="wp-input-btn"
                            title="Emoji"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <FaSmile />
                        </button>
                        <button className="wp-input-btn" title="Attach file">
                            <FaPaperclip />
                        </button>
                        <button className="wp-input-btn" title="Camera">
                            <FaCamera />
                        </button>
                        <div className="wp-input-wrapper">
                            <textarea
                                ref={inputRef}
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={handleInputChange}
                                onKeyPress={handleKeyPress}
                                className="wp-message-input"
                                rows={1}
                                disabled={!isConnected && connectionStatus === 'disconnected'}
                            />
                        </div>
                        <button
                            className="wp-send-btn"
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim() || !isConnected}
                            title="Send message"
                        >
                            {newMessage.trim() ? <FaPaperPlane /> : <FaMicrophone />}
                        </button>
                    </div>
                </div>

                {/* Group Info Panel */}
                <GroupInfoPanel
                    group={group}
                    isOpen={showInfoPanel}
                    onClose={() => setShowInfoPanel(false)}
                    onlineUsers={onlineUsers}
                    userPresence={userPresence}
                />
            </div>
        </>
    );
};

export default GroupChat;
