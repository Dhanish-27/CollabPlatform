import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaUsers, FaGithub, FaSlack, FaCheck, FaClock, FaUserPlus } from 'react-icons/fa';
import './ProjectDetail.css';

const ProjectDetail = React.memo(() => {
    const { slug } = useParams();
    const { user } = useContext(AuthContext);
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joinMessage, setJoinMessage] = useState('');
    const [rolePreference, setRolePreference] = useState('contributor');

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
            fetchProject();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to send join request');
        }
    }, [joinMessage, rolePreference, slug, project]);

    const handleBookmark = useCallback(async () => {
        try {
            await axios.post(`/api/projects/${slug}/bookmark/`);
            fetchProject();
        } catch (error) {
            console.error('Error bookmarking project:', error);
        }
    }, [slug, project]);

    if (loading) return <div className="loading">Loading...</div>;
    if (!project) return <div className="error">Project not found</div>;

    return (
        <div className="project-detail">
            <div className="container">
                <div className="project-header">
                    <div className="project-title-section">
                        <span className="project-category">{project.category}</span>
                        <h1>{project.title}</h1>
                        <div className="project-status">
                            <span className={`status-badge ${project.status}`}>
                                {project.status.replace('_', ' ')}
                            </span>
                            <span className={`difficulty ${project.difficulty}`}>
                                {project.difficulty}
                            </span>
                            {project.is_beginner_friendly && (
                                <span className="beginner-friendly">Beginner Friendly</span>
                            )}
                        </div>
                    </div>

                    <div className="project-actions">
                        {!project.is_member && project.status !== 'completed' && (
                            <button onClick={handleJoin} className="btn btn-primary">
                                <FaUserPlus /> Join Project
                            </button>
                        )}
                        <button onClick={handleBookmark} className="btn btn-outline">
                            {project.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
                        </button>
                    </div>
                </div>

                <div className="project-content">
                    <div className="project-main">
                        <section className="project-section">
                            <h2>About This Project</h2>
                            <p>{project.description}</p>
                        </section>

                        <section className="project-section">
                            <h2>Problem Statement</h2>
                            <p className="problem-statement">{project.problem_statement}</p>
                        </section>

                        <section className="project-section">
                            <h2>Tech Stack</h2>
                            <div className="tech-stack">
                                {project.tech_stack?.map((tech, index) => (
                                    <span key={index} className="tech-tag">{tech}</span>
                                ))}
                            </div>
                        </section>

                        {!project.is_member && project.status !== 'completed' && (
                            <section className="join-section">
                                <h2>Want to Join?</h2>
                                <div className="join-form">
                                    <select
                                        value={rolePreference}
                                        onChange={(e) => setRolePreference(e.target.value)}
                                    >
                                        <option value="contributor">Contributor</option>
                                        <option value="maintainer">Maintainer</option>
                                        <option value="mentor">Mentor</option>
                                    </select>
                                    <textarea
                                        placeholder="Introduce yourself and why you want to join..."
                                        value={joinMessage}
                                        onChange={(e) => setJoinMessage(e.target.value)}
                                    />
                                    <button onClick={handleJoin} className="btn btn-primary">
                                        Send Join Request
                                    </button>
                                </div>
                            </section>
                        )}
                    </div>

                    <div className="project-sidebar">
                        <div className="sidebar-card">
                            <h3>Project Info</h3>
                            <div className="info-item">
                                <FaUsers /> {project.member_count} / {project.max_team_size} members
                            </div>
                            <div className="info-item">
                                <FaClock /> {project.estimated_duration || 'Flexible'}
                            </div>
                            <div className="info-item">
                                <FaCheck /> {project.completion_percentage}% complete
                            </div>
                        </div>

                        <div className="sidebar-card">
                            <h3>Team Members</h3>
                            <div className="members-list">
                                {project.members?.map((member) => (
                                    <Link to={`/profile/${member.user.id}`} key={member.id} className="member-item">
                                        <div className="member-avatar">
                                            {member.user.username?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="member-info">
                                            <span className="member-name">{member.user.username}</span>
                                            <span className="member-role">{member.role}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="sidebar-card">
                            <h3>Required Roles</h3>
                            <div className="required-roles">
                                {project.required_roles?.map((role, index) => (
                                    <span key={index} className="role-tag">{role}</span>
                                ))}
                            </div>
                        </div>

                        <div className="sidebar-card owner-card">
                            <h3>Project Owner</h3>
                            <Link to={`/profile/${project.owner.id}`} className="owner-info">
                                <div className="owner-avatar">
                                    {project.owner.username?.[0]?.toUpperCase()}
                                </div>
                                <span>{project.owner.username}</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ProjectDetail.displayName = 'ProjectDetail';
export default ProjectDetail;
