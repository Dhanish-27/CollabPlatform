import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import {
    FaGithub, FaGlobe, FaUsers, FaUserPlus, FaBookmark,
    FaRegBookmark, FaCheck, FaClock, FaStar, FaCalendar,
    FaExclamationTriangle, FaLock, FaEye, FaCode, FaTag,
    FaArrowRight, FaTrophy, FaProjectDiagram, FaUserClock
} from 'react-icons/fa';
import './ProjectDetail.css';

const ProjectDetail = () => {
    const { slug } = useParams();
    const { user: currentUser } = useContext(AuthContext);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joinMessage, setJoinMessage] = useState('');
    const [rolePreference, setRolePreference] = useState('contributor');
    const [showJoinForm, setShowJoinForm] = useState(false);
    const [activeTab, setActiveTab] = useState('details');

    useEffect(() => {
        fetchProject();
    }, [slug]);

    const fetchProject = async () => {
        try {
            const response = await axios.get(`/api/projects/${slug}/`);
            setProject(response.data);
        } catch (error) {
            console.error('Error fetching project:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = useCallback(async () => {
        try {
            await axios.post(`/api/projects/${slug}/join/`, {
                message: joinMessage,
                role_preference: rolePreference
            });
            alert('Join request sent successfully!');
            setShowJoinForm(false);
            setJoinMessage('');
            fetchProject();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to send join request');
        }
    }, [joinMessage, rolePreference, slug]);

    const handleBookmark = useCallback(async () => {
        try {
            await axios.post(`/api/projects/${slug}/bookmark/`);
            fetchProject();
        } catch (error) {
            console.error('Error bookmarking project:', error);
        }
    }, [slug]);

    const handleJoinRequestAction = useCallback(async (requestId, action) => {
        try {
            await axios.post(`/api/projects/${slug}/handle_join_request/`, {
                request_id: requestId,
                action: action
            });
            alert(`Join request ${action}ed successfully!`);
            fetchProject();
        } catch (error) {
            alert(error.response?.data?.error || `Failed to ${action} join request`);
        }
    }, [slug]);

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            'idea': '#888888',
            'accepting': '#28a745',
            'in_progress': '#007bff',
            'completed': '#6c757d',
            'archived': '#6c757d'
        };
        return colors[status] || '#888888';
    };

    const getDifficultyColor = (difficulty) => {
        const colors = {
            'beginner': '#28a745',
            'intermediate': '#ffc107',
            'advanced': '#fd7e14',
            'expert': '#dc3545'
        };
        return colors[difficulty] || '#888888';
    };

    const getHealthColor = (health) => {
        const colors = {
            'active': '#28a745',
            'slow': '#ffc107',
            'inactive': '#dc3545'
        };
        return colors[health] || '#888888';
    };

    const isOwner = project && project.is_member && project.user_role === 'owner';

    if (loading) return <div className="project-detail-loading">Loading project...</div>;
    if (!project) return <div className="project-detail-error">Project not found</div>;

    return (
        <div className="project-detail-page">
            <div className="container">
                {/* Project Header */}
                <div className="project-header">
                    <div className="project-avatar-large">
                        <FaProjectDiagram />
                    </div>
                    <div className="project-header-info">
                        <div className="project-name-row">
                            <h1>{project.title}</h1>
                            {project.is_featured && (
                                <span className="featured-badge">
                                    <FaStar /> Featured
                                </span>
                            )}
                        </div>
                        <p className="project-category-tag">
                            <FaTag /> {project.category}
                        </p>
                        <div className="project-meta">
                            <span><FaClock /> Created {formatDate(project.created_at)}</span>
                            {project.estimated_duration && (
                                <span><FaCalendar /> {project.estimated_duration}</span>
                            )}
                            <span className="visibility-badge">
                                {project.visibility === 'private' ? <FaLock /> : <FaEye />}
                                {project.visibility}
                            </span>
                        </div>
                    </div>
                    <div className="project-actions">
                        {!project.is_member && project.status !== 'completed' && (
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowJoinForm(!showJoinForm)}
                            >
                                <FaUserPlus /> Join Project
                            </button>
                        )}
                        <button
                            className={`btn ${project.is_bookmarked ? 'btn-primary' : 'btn-outline'}`}
                            onClick={handleBookmark}
                        >
                            {project.is_bookmarked ? <FaBookmark /> : <FaRegBookmark />}
                            {project.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
                        </button>
                    </div>
                </div>

                {/* Join Form Section */}
                {showJoinForm && !project.is_member && (
                    <div className="join-form-section">
                        <h3>Request to Join</h3>
                        <div className="join-form">
                            <div className="form-group">
                                <label>Your Role</label>
                                <select
                                    value={rolePreference}
                                    onChange={(e) => setRolePreference(e.target.value)}
                                    className="form-select"
                                >
                                    <option value="contributor">Contributor</option>
                                    <option value="maintainer">Maintainer</option>
                                    <option value="mentor">Mentor</option>
                                    <option value="observer">Observer</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Introduction Message</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Introduce yourself and explain why you want to join this project..."
                                    value={joinMessage}
                                    onChange={(e) => setJoinMessage(e.target.value)}
                                    rows={4}
                                />
                            </div>
                            <div className="form-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleJoin}
                                >
                                    Send Request
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setShowJoinForm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs for Owner */}
                {isOwner && (
                    <div className="project-tabs">
                        <button
                            className={`project-tab ${activeTab === 'details' ? 'active' : ''}`}
                            onClick={() => setActiveTab('details')}
                        >
                            Project Details
                        </button>
                        <button
                            className={`project-tab ${activeTab === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveTab('requests')}
                        >
                            <FaUserClock /> Requests
                            {project.join_requests && project.join_requests.length > 0 && (
                                <span className="tab-badge">{project.join_requests.length}</span>
                            )}
                        </button>
                    </div>
                )}

                {/* Content based on tabs */}
                <div className="project-content">
                    {(!isOwner || activeTab === 'details') && (
                        <>
                            {/* Main Content - Project Details */}
                            <div className="project-main">
                                {/* About Section */}
                                <section className="project-section">
                                    <div className="section-header">
                                        <h2>About This Project</h2>
                                    </div>
                                    <p className="about-text">{project.description}</p>
                                </section>

                                {/* Problem Statement Section */}
                                <section className="project-section">
                                    <div className="section-header">
                                        <h2><FaExclamationTriangle /> Problem Statement</h2>
                                    </div>
                                    <p className="problem-statement">{project.problem_statement}</p>
                                </section>

                                {/* Tech Stack Section */}
                                <section className="project-section">
                                    <div className="section-header">
                                        <h2><FaCode /> Tech Stack</h2>
                                    </div>
                                    <div className="tech-stack">
                                        {project.tech_stack && project.tech_stack.length > 0 ? (
                                            project.tech_stack.map((tech, index) => (
                                                <span key={index} className="tech-tag">{tech}</span>
                                            ))
                                        ) : (
                                            <p className="empty-text">No tech stack specified.</p>
                                        )}
                                    </div>
                                </section>

                                {/* Required Roles Section */}
                                <section className="project-section">
                                    <div className="section-header">
                                        <h2><FaUsers /> Looking For</h2>
                                    </div>
                                    <div className="required-roles">
                                        {project.required_roles && project.required_roles.length > 0 ? (
                                            project.required_roles.map((role, index) => (
                                                <span key={index} className="role-tag">{role}</span>
                                            ))
                                        ) : (
                                            <p className="empty-text">No specific roles needed at the moment.</p>
                                        )}
                                    </div>
                                </section>
                            </div>

                            {/* Sidebar */}
                            <div className="project-sidebar">
                                {/* Project Status Card */}
                                <div className="status-card">
                                    <h3>Project Status</h3>
                                    <div className="status-grid">
                                        <div className="status-item">
                                            <span className="status-label">Status</span>
                                            <span
                                                className="status-badge"
                                                style={{ backgroundColor: getStatusColor(project.status) }}
                                            >
                                                {project.status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="status-item">
                                            <span className="status-label">Difficulty</span>
                                            <span
                                                className="difficulty-badge"
                                                style={{ backgroundColor: getDifficultyColor(project.difficulty) }}
                                            >
                                                {project.difficulty}
                                            </span>
                                        </div>
                                        <div className="status-item">
                                            <span className="status-label">Health</span>
                                            <span
                                                className="health-badge"
                                                style={{ backgroundColor: getHealthColor(project.health_status) }}
                                            >
                                                {project.health_status}
                                            </span>
                                        </div>
                                        {project.is_beginner_friendly && (
                                            <div className="status-item">
                                                <span className="beginner-badge">Beginner Friendly</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Team Overview Card */}
                                <div className="team-card">
                                    <h3><FaUsers /> Team Overview</h3>
                                    <div className="team-stats">
                                        <div className="team-stat-item">
                                            <span className="team-stat-value">{project.member_count || 0}</span>
                                            <span className="team-stat-label">Members</span>
                                        </div>
                                        <div className="team-stat-item">
                                            <span className="team-stat-value">{project.max_team_size}</span>
                                            <span className="team-stat-label">Max Team Size</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Team Members Card */}
                                <div className="members-card">
                                    <h3>Team Members</h3>
                                    <div className="members-list">
                                        {project.members && project.members.length > 0 ? (
                                            project.members.slice(0, 5).map((member) => (
                                                <Link
                                                    to={member.user && member.user.id ? `/profile/${member.user.id}` : '#'}
                                                    key={member.id || member._id || Math.random()}
                                                    className="member-item"
                                                >
                                                    <div className="member-avatar">
                                                        {member.user && member.user.username ? member.user.username?.[0]?.toUpperCase() : '?'}
                                                    </div>
                                                    <div className="member-info">
                                                        <span className="member-name">{member.user && member.user.username ? member.user.username : 'Unknown User'}</span>
                                                        <span className="member-role">{member.role || ''}</span>
                                                    </div>
                                                </Link>
                                            ))
                                        ) : (
                                            <p className="empty-text">No members yet.</p>
                                        )}
                                        {project.members && project.members.length > 5 && (
                                            <Link to="#" className="view-all-members">
                                                View all {project.members.length} members <FaArrowRight />
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Project Owner Card */}
                                <div className="owner-card">
                                    <h3>Project Owner</h3>
                                    <Link to={project.owner && project.owner.id ? `/profile/${project.owner.id}` : '#'} className="owner-link">
                                        <div className="owner-avatar">
                                            {project.owner && project.owner.username ? project.owner.username?.[0]?.toUpperCase() : '?'}
                                        </div>
                                        <div className="owner-info">
                                            <span className="owner-name">{project.owner && project.owner.username ? project.owner.username : 'Unknown Owner'}</span>
                                            <span className="owner-label">Owner</span>
                                        </div>
                                    </Link>
                                </div>

                                {/* Your Role Card (for members only) */}
                                {project.is_member && project.user_role && project.user_role.trim() !== '' && (
                                    <div className="your-role-card">
                                        <h3><FaTrophy /> Your Role</h3>
                                        <div className="your-role">
                                            <span className="role-badge">{project.user_role}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Requests Tab - Only for Owner */}
                    {isOwner && activeTab === 'requests' && (
                        <div className="requests-tab-content">
                            <div className="requests-section">
                                <h2><FaUserClock /> Join Requests</h2>

                                {(!project.join_requests || project.join_requests.length === 0) ? (
                                    <div className="no-requests">
                                        <p>No pending join requests at the moment.</p>
                                    </div>
                                ) : (
                                    <div className="requests-table">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>User</th>
                                                    <th>Role</th>
                                                    <th>Message</th>
                                                    <th>Date</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {project.join_requests.map((request) => (
                                                    <tr key={request.id}>
                                                        <td>
                                                            <Link
                                                                to={request.user && request.user.id ? `/profile/${request.user.id}` : '#'}
                                                                className="request-user-link"
                                                            >
                                                                <div className="request-user-cell">
                                                                    <div className="request-avatar">
                                                                        {request.user && request.user.username ? request.user.username?.[0]?.toUpperCase() : '?'}
                                                                    </div>
                                                                    <span>{request.user && request.user.username ? request.user.username : 'Unknown User'}</span>
                                                                </div>
                                                            </Link>
                                                        </td>
                                                        <td>
                                                            <span className="role-badge">{request.role_preference}</span>
                                                        </td>
                                                        <td className="message-cell">
                                                            {request.message || <span className="no-message">No message</span>}
                                                        </td>
                                                        <td className="date-cell">
                                                            {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="actions-cell">
                                                            <div className="action-buttons">
                                                                <button
                                                                    onClick={() => handleJoinRequestAction(request.id, 'accept')}
                                                                    className="btn btn-sm btn-success"
                                                                >
                                                                    Accept
                                                                </button>
                                                                <button
                                                                    onClick={() => handleJoinRequestAction(request.id, 'reject')}
                                                                    className="btn btn-sm btn-danger"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectDetail;
