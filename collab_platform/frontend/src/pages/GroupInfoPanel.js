import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FaTimes,
    FaSearch,
    FaArrowLeft,
    FaUserPlus,
    FaImage,
    FaLink,
    FaBell,
    FaBellSlash,
    FaStar,
    FaTrash,
    FaInfoCircle,
    FaUsers,
    FaCog,
    FaLock,
    FaCheck,
    FaCircle
} from 'react-icons/fa';
import './GroupInfoPanel.css';

/**
 * Format last seen timestamp for display
 * @param {string|null} lastSeen - ISO timestamp
 * @returns {string}
 */
const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'offline';

    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'last seen just now';
    if (diffMins < 60) return `last seen ${diffMins}m ago`;
    if (diffHours < 24) return `last seen ${diffHours}h ago`;
    if (diffDays < 7) return `last seen ${diffDays}d ago`;

    return `last seen ${date.toLocaleDateString()}`;
};

const GroupInfoPanel = ({ group, isOpen, onClose, onlineUsers = new Set(), userPresence = {} }) => {
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && group) {
            fetchMembers();
        }
    }, [isOpen, group]);

    const fetchMembers = async () => {
        setLoadingMembers(true);
        try {
            const response = await axios.get(`/api/projects/${group.id}/`);
            setMembers(response.data.members || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const filteredMembers = members.filter(member => {
        const name = member.user?.username || member.user?.email || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="wp-info-panel-overlay" onClick={onClose}>
            <div
                className="wp-info-panel"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Panel Header */}
                <div className="wp-info-panel-header">
                    <button className="wp-back-btn" onClick={onClose}>
                        <FaArrowLeft />
                    </button>
                    <h2>Group Info</h2>
                    <button className="wp-close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                {/* Group Profile */}
                <div className="wp-info-panel-profile">
                    <div className="wp-info-avatar">
                        {group.image ? (
                            <img src={group.image} alt={group.title} />
                        ) : (
                            <div className="wp-avatar-placeholder wp-avatar-large">
                                {group.title.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <button className="wp-avatar-edit" title="Change group icon">
                            <FaImage />
                        </button>
                    </div>
                    <h3 className="wp-info-title">{group.title}</h3>
                    <p className="wp-info-subtitle">
                        {members.length} participants
                    </p>
                </div>

                {/* Tabs */}
                <div className="wp-info-tabs">
                    <button
                        className={`wp-info-tab ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        <FaInfoCircle /> Info
                    </button>
                    <button
                        className={`wp-info-tab ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => setActiveTab('members')}
                    >
                        <FaUsers /> Members
                    </button>
                    <button
                        className={`wp-info-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <FaCog /> Settings
                    </button>
                </div>

                {/* Tab Content */}
                <div className="wp-info-content">
                    {activeTab === 'info' && (
                        <div className="wp-info-section">
                            <div className="wp-info-item">
                                <span className="wp-info-label">Description</span>
                                <p className="wp-info-value">
                                    {group.description || 'No description'}
                                </p>
                            </div>

                            <div className="wp-info-item">
                                <span className="wp-info-label">Created</span>
                                <p className="wp-info-value">
                                    {formatDate(group.created_at)}
                                </p>
                            </div>

                            <div className="wp-info-item">
                                <span className="wp-info-label">Status</span>
                                <p className="wp-info-value">
                                    <span className={`wp-status-tag ${group.status}`}>
                                        {group.status?.replace('_', ' ') || 'active'}
                                    </span>
                                </p>
                            </div>

                            <div className="wp-info-item">
                                <span className="wp-info-label">Category</span>
                                <p className="wp-info-value">
                                    {group.category || 'Not specified'}
                                </p>
                            </div>

                            {group.tech_stack && group.tech_stack.length > 0 && (
                                <div className="wp-info-item">
                                    <span className="wp-info-label">Tech Stack</span>
                                    <div className="wp-tech-tags">
                                        {group.tech_stack.map((tech, index) => (
                                            <span key={index} className="wp-tech-tag">{tech}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="wp-info-item">
                                <span className="wp-info-label">Link</span>
                                <p className="wp-info-value wp-info-link">
                                    <FaLink /> /projects/{group.id}
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'members' && (
                        <div className="wp-members-section">
                            <div className="wp-members-search">
                                <FaSearch className="wp-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search members..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {loadingMembers ? (
                                <div className="wp-members-loading">
                                    <div className="wp-spinner-small"></div>
                                    <p>Loading members...</p>
                                </div>
                            ) : (
                                <div className="wp-members-list">
                                    {filteredMembers.map((member, index) => {
                                        // Get member user ID (handle different data structures)
                                        const memberUserId = member.user?.id || member.id;
                                        const isOnline = onlineUsers.has(memberUserId);
                                        const presence = userPresence[memberUserId];

                                        return (
                                            <div key={member.id || index} className="wp-member-item">
                                                <div className="wp-member-avatar">
                                                    {member.user?.profile_image ? (
                                                        <img
                                                            src={member.user.profile_image}
                                                            alt={member.user.username}
                                                        />
                                                    ) : (
                                                        <div className="wp-avatar-placeholder">
                                                            {(member.user?.username || member.user?.email || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {/* Online indicator */}
                                                    {isOnline && (
                                                        <div className="wp-member-online-indicator"></div>
                                                    )}
                                                </div>
                                                <div className="wp-member-info">
                                                    <span className="wp-member-name">
                                                        {member.user?.username || member.user?.email || 'Unknown'}
                                                    </span>
                                                    <span className={`wp-member-status ${isOnline ? 'wp-status-online' : 'wp-status-offline'}`}>
                                                        {isOnline ? 'online' : (presence?.lastSeen ? formatLastSeen(presence.lastSeen) : 'offline')}
                                                    </span>
                                                </div>
                                                {member.role === 'owner' && (
                                                    <span className="wp-owner-badge">
                                                        <FaStar /> Admin
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="wp-settings-section">
                            <div className="wp-settings-group">
                                <h4>Notifications</h4>
                                <div className="wp-setting-item">
                                    <div className="wp-setting-info">
                                        <FaBell />
                                        <span>Mute notifications</span>
                                    </div>
                                    <label className="wp-toggle">
                                        <input type="checkbox" />
                                        <span className="wp-toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="wp-settings-group">
                                <h4>Privacy</h4>
                                <div className="wp-setting-item">
                                    <div className="wp-setting-info">
                                        <FaLock />
                                        <span>Read receipts</span>
                                    </div>
                                    <label className="wp-toggle">
                                        <input type="checkbox" defaultChecked />
                                        <span className="wp-toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="wp-settings-group">
                                <h4>Danger Zone</h4>
                                <button className="wp-danger-btn">
                                    <FaTrash /> Leave Group
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupInfoPanel;
