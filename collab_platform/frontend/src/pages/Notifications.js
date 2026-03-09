import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaBell, FaCheck, FaLink, FaUserPlus, FaTasks, FaEnvelope, FaTrash, FaCheckDouble } from 'react-icons/fa';
import './Notifications.css';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState('all'); // all, unread, read

    useEffect(() => {
        fetchNotifications();
        fetchUnreadCount();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await axios.get('/api/notifications/');
            setNotifications(response.data.results || response.data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try {
            const response = await axios.get('/api/notifications/unread_count/');
            setUnreadCount(response.data.count);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const markAllRead = async () => {
        try {
            await axios.post('/api/notifications/mark_all_read/');
            setNotifications(notifications.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            await axios.post(`/api/notifications/${id}/mark_read/`);
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await axios.delete(`/api/notifications/${id}/`);
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'join_request':
            case 'join_request_accepted':
            case 'join_request_rejected':
                return <FaUserPlus />;
            case 'task_assigned':
            case 'task_completed':
                return <FaTasks />;
            case 'announcement':
                return <FaBell />;
            case 'message':
                return <FaEnvelope />;
            default:
                return <FaLink />;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread') return !n.is_read;
        if (filter === 'read') return n.is_read;
        return true;
    });

    if (loading) return <div className="loading">Loading notifications...</div>;

    return (
        <div className="notifications-page">
            <div className="container">
                <div className="notifications-header">
                    <div className="notifications-header-content">
                        <h1>Notifications</h1>
                        <p>{unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}</p>
                    </div>
                    <div className="notifications-actions">
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} className="btn btn-outline">
                                <FaCheckDouble /> Mark all as read
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="notifications-filter">
                    <button
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        Unread {unreadCount > 0 && <span className="filter-count">{unreadCount}</span>}
                    </button>
                    <button
                        className={`filter-tab ${filter === 'read' ? 'active' : ''}`}
                        onClick={() => setFilter('read')}
                    >
                        Read
                    </button>
                </div>

                <div className="notifications-list">
                    {filteredNotifications.length > 0 ? (
                        filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                            >
                                <div className="notification-icon">
                                    {getNotificationIcon(notification.notification_type)}
                                </div>
                                <div className="notification-content">
                                    <div className="notification-header">
                                        <h3>{notification.title}</h3>
                                        <span className="notification-time">
                                            {formatTime(notification.created_at)}
                                        </span>
                                    </div>
                                    <p>{notification.message}</p>
                                </div>
                                <div className="notification-item-actions">
                                    {!notification.is_read && (
                                        <button
                                            className="action-btn"
                                            onClick={() => markAsRead(notification.id)}
                                            title="Mark as read"
                                        >
                                            <FaCheck />
                                        </button>
                                    )}
                                    {notification.link && (
                                        <Link to={notification.link} className="action-btn">
                                            View
                                        </Link>
                                    )}
                                    <button
                                        className="action-btn action-btn-delete"
                                        onClick={() => deleteNotification(notification.id)}
                                        title="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon-wrapper">
                                <FaBell className="empty-icon" />
                            </div>
                            <h3>No notifications</h3>
                            <p>
                                {filter === 'unread'
                                    ? "You have no unread notifications"
                                    : filter === 'read'
                                        ? "You have no read notifications"
                                        : "You don't have any notifications yet"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
