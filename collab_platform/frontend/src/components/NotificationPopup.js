import React, { useState, useEffect, useCallback } from 'react';
import { FaBell, FaCheck, FaTimes, FaLink, FaUserPlus, FaTasks, FaEnvelope } from 'react-icons/fa';

const NotificationPopup = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showPopup, setShowPopup] = useState(false);
    const [lastFetched, setLastFetched] = useState(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch('/api/notifications/');
            const data = await response.json();
            const notifs = Array.isArray(data) ? data : (data.results || []);

            // Get only unread notifications
            const unread = notifs.filter(n => !n.is_read);

            if (unread.length > unreadCount && lastFetched) {
                // New notifications arrived - show popup
                setNotifications(unread.slice(0, 3));
                setShowPopup(true);

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    setShowPopup(false);
                }, 5000);
            }

            setUnreadCount(unread.length);
            setLastFetched(new Date());
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, [unreadCount, lastFetched]);

    useEffect(() => {
        // Fetch notifications on mount and set up polling
        fetchNotifications();

        const interval = setInterval(fetchNotifications, 15000); // Check every 15 seconds

        return () => clearInterval(interval);
    }, [fetchNotifications]);

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

    const markAsRead = async (id) => {
        try {
            await fetch(`/api/notifications/${id}/mark_read/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            setNotifications(notifications.filter(n => n.id !== id));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const dismissPopup = () => {
        setShowPopup(false);
    };

    if (!showPopup || notifications.length === 0) {
        return null;
    }

    return (
        <div className="notification-popup-container">
            <div className="notification-popup">
                <div className="notification-popup-header">
                    <div className="notification-popup-title">
                        <FaBell />
                        <span>New Notifications</span>
                    </div>
                    <button className="notification-popup-close" onClick={dismissPopup}>
                        <FaTimes />
                    </button>
                </div>

                <div className="notification-popup-list">
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className="notification-popup-item"
                            onClick={() => {
                                markAsRead(notification.id);
                                if (notification.link) {
                                    window.location.href = notification.link;
                                }
                            }}
                        >
                            <div className="notification-popup-icon">
                                {getNotificationIcon(notification.notification_type)}
                            </div>
                            <div className="notification-popup-content">
                                <h4>{notification.title}</h4>
                                <p>{notification.message}</p>
                            </div>
                            <button
                                className="notification-popup-dismiss"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="notification-popup-footer">
                    <a href="/notifications">View all notifications</a>
                </div>
            </div>

            <style>{`
                .notification-popup-container {
                    position: fixed;
                    top: 90px;
                    right: 24px;
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                .notification-popup {
                    width: 360px;
                    max-height: 400px;
                    background: #ffffff;
                    border: 2px solid #000000;
                    border-radius: 4px;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                }
                
                .notification-popup-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: #000000;
                    color: #ffffff;
                }
                
                .notification-popup-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .notification-popup-close {
                    background: none;
                    border: none;
                    color: #ffffff;
                    cursor: pointer;
                    padding: 4px;
                    font-size: 14px;
                    opacity: 0.7;
                }
                
                .notification-popup-close:hover {
                    opacity: 1;
                }
                
                .notification-popup-list {
                    max-height: 280px;
                    overflow-y: auto;
                }
                
                .notification-popup-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px 20px;
                    border-bottom: 1px solid #f5f5f5;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                
                .notification-popup-item:hover {
                    background: #f5f5f5;
                }
                
                .notification-popup-item:last-child {
                    border-bottom: none;
                }
                
                .notification-popup-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000000;
                    color: #ffffff;
                    border-radius: 50%;
                    flex-shrink: 0;
                    font-size: 14px;
                }
                
                .notification-popup-content {
                    flex: 1;
                    min-width: 0;
                }
                
                .notification-popup-content h4 {
                    margin: 0 0 4px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #000000;
                }
                
                .notification-popup-content p {
                    margin: 0;
                    font-size: 13px;
                    color: #666666;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .notification-popup-dismiss {
                    background: none;
                    border: none;
                    color: #888888;
                    cursor: pointer;
                    padding: 4px;
                    font-size: 12px;
                    opacity: 0;
                    transition: opacity 0.15s;
                }
                
                .notification-popup-item:hover .notification-popup-dismiss {
                    opacity: 1;
                }
                
                .notification-popup-dismiss:hover {
                    color: #000000;
                }
                
                .notification-popup-footer {
                    padding: 12px 20px;
                    background: #f5f5f5;
                    text-align: center;
                }
                
                .notification-popup-footer a {
                    color: #000000;
                    font-size: 13px;
                    font-weight: 600;
                    text-decoration: none;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .notification-popup-footer a:hover {
                    text-decoration: underline;
                }
                
                @media (max-width: 480px) {
                    .notification-popup-container {
                        right: 12px;
                        left: 12px;
                    }
                    
                    .notification-popup {
                        width: auto;
                    }
                }
            `}</style>
        </div>
    );
};

export default NotificationPopup;
