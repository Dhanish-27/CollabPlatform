import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaProjectDiagram, FaTasks, FaStar, FaUsers, FaBell, FaArrowRight, FaSignOutAlt } from 'react-icons/fa';
import './Dashboard.css';

const Dashboard = React.memo(() => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [myProjects, setMyProjects] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [projectsRes, statsRes] = await Promise.all([
                axios.get('/api/projects/my_projects/'),
                axios.get('/api/analytics/dashboard/')
            ]);
            setMyProjects(projectsRes.data);
            setStats(statsRes.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (loading) return <div className="loading">Loading dashboard...</div>;

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header">
                    <div className="header-text">
                        <h1>Welcome back, {user?.username}!</h1>
                        <p>Here's what's happening with your projects</p>
                    </div>
                    <div className="header-actions">
                        <button onClick={handleLogout} className="btn-logout-header">
                            <FaSignOutAlt /> Logout
                        </button>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon"><FaProjectDiagram /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats?.owned_projects || 0}</span>
                            <span className="stat-label">Projects Owned</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><FaUsers /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats?.joined_projects || 0}</span>
                            <span className="stat-label">Projects Joined</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><FaTasks /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats?.completed_tasks || 0}</span>
                            <span className="stat-label">Tasks Completed</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><FaStar /></div>
                        <div className="stat-content">
                            <span className="stat-value">{stats?.teamwork_rating?.toFixed(1) || '0.0'}</span>
                            <span className="stat-label">Team Rating</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-sections">
                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>My Projects</h2>
                            <Link to="/projects/new" className="btn btn-outline btn-sm">
                                New Project
                            </Link>
                        </div>

                        <div className="projects-list">
                            {myProjects.length > 0 ? (
                                myProjects.map((project) => (
                                    <Link to={`/projects/${project.slug}`} key={project.id} className="project-item">
                                        <div className="project-info">
                                            <h3>{project.title}</h3>
                                            <span className={`status ${project.status}`}>
                                                {project.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="project-progress">
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-fill"
                                                    style={{ width: `${project.completion_percentage}%` }}
                                                />
                                            </div>
                                            <span>{project.completion_percentage}% complete</span>
                                        </div>
                                        <FaArrowRight className="arrow" />
                                    </Link>
                                ))
                            ) : (
                                <div className="empty-state">
                                    <p>You haven't joined any projects yet.</p>
                                    <Link to="/projects" className="btn btn-primary">
                                        Explore Projects
                                    </Link>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="dashboard-section">
                        <div className="section-header">
                            <h2>Quick Actions</h2>
                        </div>

                        <div className="quick-actions">
                            <Link to="/projects/new" className="action-card">
                                <FaProjectDiagram />
                                <span>Create Project</span>
                            </Link>
                            <Link to="/projects" className="action-card">
                                <FaUsers />
                                <span>Find Projects</span>
                            </Link>
                            <Link to={`/profile/${user?.id}`} className="action-card">
                                <FaStar />
                                <span>View Profile</span>
                            </Link>
                            <Link to="/notifications" className="action-card">
                                <FaBell />
                                <span>Notifications</span>
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
export default Dashboard;
