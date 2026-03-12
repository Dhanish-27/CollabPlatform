import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaBell, FaCheck, FaLink, FaUserPlus, FaTasks, FaEnvelope, FaTrash, FaCheckDouble, FaClock, FaUser, FaTimes } from 'react-icons/fa';
import './Notifications.css';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [filter, setFilter] = useState('all'); // all, unread, read
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchNotifications();
        fetchUnreadCount();
        fetchPendingRequests();
    }, []);

    const fetchPendingRequests = async () => {
        try {
            setLoadingRequests(true);
            // Fetch owned projects first
            const ownedRes = await axios.get('/api/projects/owned_projects/');
            const ownedProjects = ownedRes.data;

            console.log('Owned projects:', ownedProjects);

            if (!ownedProjects || ownedProjects.length === 0) {
                setPendingRequests([]);
                return;
            }

            // Fetch pending join requests for each owned project
            const results = await Promise.all(
                ownedProjects.map((p) =>
                    axios
                        .get(`/api/projects/${p.id}/join_requests/?status=pending`)
                        .then((res) => {
                            const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
                            console.log(`Requests for project ${p.id}:`, data);
                            return data.map((r) => ({ ...r, projectTitle: p.title, projectId: p.id }));
                        })
                        .catch((err) => {
                            console.error(`Error fetching requests for project ${p.id}:`, err);
                            return [];
                        })
                )
            );
            const allRequests = results.flat().filter(Boolean);
            console.log('All pending requests:', allRequests);
            setPendingRequests(allRequests);
        } catch (error) {
            console.error('Error fetching pending requests:', error);
            setPendingRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    };

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

    const handleRequestAction = async (projectId, requestId, action) => {
        setActionLoading(requestId);
        try {
            await axios.post(`/api/projects/${projectId}/handle_join_request/`, {
                request_id: requestId,
                action, // 'accept' | 'reject'
            });
            // Remove from local list
            setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

            // Show success message
            if (action === 'accept') {
                alert('Join request accepted! The user has been added to the project.');
            } else {
                alert('Join request rejected.');
            }
        } catch (err) {
            console.error('Error handling join request:', err);
            alert(err.response?.data?.error || 'Action failed. Please try again.');
        } finally {
            setActionLoading(null);
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
                {/* Pending Join Requests Section */}
                {(loadingRequests || pendingRequests.length > 0) && (
                    <div className="notifications-section pending-requests-section">
                        <div className="section-header">
                            <h2><FaUserPlus /> Pending Join Requests</h2>
                            <span className="section-badge">{pendingRequests.length}</span>
                        </div>

                        {loadingRequests ? (
                            <p className="loading-text">Loading requests...</p>
                        ) : pendingRequests.length === 0 ? (
                            <p className="empty-text">No pending join requests for your projects.</p>
                        ) : (
                            <div className="pending-requests-list">
                                {pendingRequests.map((req) => (
                                    <div key={req.id} className="pending-request-item">
                                        <div className="request-header">
                                            <div className="request-user">
                                                <FaUser className="user-icon" />
                                                <span>{req.user?.username || req.user?.email || `User #${req.user}`}</span>
                                            </div>
                                            <span className="request-project">{req.projectTitle}</span>
                                        </div>

                                        <div className="request-details">
                                            <div className="request-role">
                                                <strong>Role:</strong> {req.role_preference || 'contributor'}
                                            </div>
                                            {req.message && (
                                                <div className="request-message">
                                                    <strong>Message:</strong> "{req.message}"
                                                </div>
                                            )}
                                        </div>

                                        <div className="request-actions">
                                            <button
                                                className="btn btn-accept"
                                                disabled={actionLoading === req.id}
                                                onClick={() => handleRequestAction(req.projectId, req.id, 'accept')}
                                            >
                                                {actionLoading === req.id ? <FaClock className="spin" /> : <FaCheck />}
                                                {actionLoading === req.id ? 'Processing...' : 'Accept'}
                                            </button>
                                            <button
                                                className="btn btn-reject"
                                                disabled={actionLoading === req.id}
                                                onClick={() => handleRequestAction(req.projectId, req.id, 'reject')}
                                            >
                                                {actionLoading === req.id ? <FaClock className="spin" /> : <FaTimes />}
                                                {actionLoading === req.id ? 'Processing...' : 'Reject'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
