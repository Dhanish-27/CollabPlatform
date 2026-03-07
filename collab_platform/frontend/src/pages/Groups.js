import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaSearch, FaComments, FaArrowLeft, FaEllipsisV } from 'react-icons/fa';
import './Groups.css';

const Groups = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        try {
            const response = await axios.get('/api/projects/my_projects/');
            setGroups(response.data);
        } catch (error) {
            console.error('Error fetching groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredGroups = groups.filter(group =>
        group.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    if (loading) {
        return (
            <div className="wp-container">
                <div className="wp-loading">
                    <div className="wp-spinner"></div>
                    <p>Loading groups...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="wp-container">
            {/* Sidebar - Groups List */}
            <div className="wp-sidebar">
                {/* Sidebar Header */}
                <div className="wp-sidebar-header">
                    <div className="wp-sidebar-header-top">
                        <h2>Groups</h2>
                        <button className="wp-icon-btn" title="New Group">
                            <FaComments />
                        </button>
                    </div>
                    <div className="wp-search-container">
                        <FaSearch className="wp-search-icon" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="wp-search-input"
                        />
                    </div>
                </div>

                {/* Groups List */}
                <div className="wp-chats-list">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map((group) => (
                            <div
                                key={group.id}
                                className="wp-chat-item"
                                onClick={() => navigate(`/groups/${group.id}`)}
                            >
                                <div className="wp-chat-avatar">
                                    {group.image ? (
                                        <img src={group.image} alt={group.title} />
                                    ) : (
                                        <div className="wp-avatar-placeholder">
                                            {group.title.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="wp-online-indicator"></div>
                                </div>
                                <div className="wp-chat-info">
                                    <div className="wp-chat-header-row">
                                        <h3 className="wp-chat-name">{group.title}</h3>
                                        <span className="wp-chat-time">
                                            {formatTime(group.updated_at || group.created_at)}
                                        </span>
                                    </div>
                                    <div className="wp-chat-preview-row">
                                        <p className="wp-chat-preview">
                                            {group.description || 'Click to start chatting'}
                                        </p>
                                        <span className={`wp-status-badge ${group.status}`}>
                                            {group.status?.replace('_', ' ') || 'active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="wp-empty-state">
                            <FaComments className="wp-empty-icon" />
                            <p>No groups found</p>
                            {searchQuery && (
                                <button
                                    className="wp-btn-link"
                                    onClick={() => setSearchQuery('')}
                                >
                                    Clear search
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area - Welcome Screen */}
            <div className="wp-main-area">
                <div className="wp-welcome-screen">
                    <div className="wp-welcome-icon">
                        <FaComments />
                    </div>
                    <h1>Welcome to Groups</h1>
                    <p>Select a group to start chatting</p>
                </div>
            </div>
        </div>
    );
};

export default Groups;
