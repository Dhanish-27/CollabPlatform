import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaBell, FaCheck, FaLink, FaUserPlus, FaTasks } from 'react-icons/fa';
import './Notifications.css';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

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
            default:
                return <FaLink />;
        }
    };

    if (loading) return <div className="loading">Loading notifications...</div>;

    return (
        <div className="notifications-page">
            <div className="container">
                <div className="notifications-header">
                    <div>
                        <h1>Notifications</h1>
                        <p>{unreadCount} unread notifications</p>
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="btn btn-outline">
                            <FaCheck /> Mark all as read
                        </button>
                    )}
                </div>

                <div className="notifications-list">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                                onClick={() => !notification.is_read && markAsRead(notification.id)}
                            >
                                <div className="notification-icon">
                                    {getNotificationIcon(notification.notification_type)}
                                </div>
                                <div className="notification-content">
                                    <h3>{notification.title}</h3>
                                    <p>{notification.message}</p>
                                    <span className="notification-time">
                                        {new Date(notification.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {notification.link && (
                                    <Link to={notification.link} className="notification-link">
                                        View
                                    </Link>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="empty-state">
                            <FaBell className="empty-icon" />
                            <p>No notifications yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Notifications;
