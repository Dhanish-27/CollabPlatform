import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaGithub, FaBell, FaUser, FaSignOutAlt, FaPlus, FaComments, FaBars, FaTimes, FaCog } from 'react-icons/fa';
import axios from 'axios';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (user) {
            fetchUnreadCount();
            // Poll for new notifications every 30 seconds
            const interval = setInterval(fetchUnreadCount, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const fetchUnreadCount = async () => {
        try {
            const response = await axios.get('/api/notifications/unread_count/');
            setUnreadCount(response.data.count || 0);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <span className="brand-icon">◈</span>
                    <span className="brand-text">CollabHub</span>
                </Link>

                <button
                    className="mobile-menu-toggle"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <FaTimes /> : <FaBars />}
                </button>

                <div className={`navbar-links ${mobileMenuOpen ? 'active' : ''}`}>
                    <Link to="/projects" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                        Explore Projects
                    </Link>
                    {user && (
                        <>
                            <Link to="/groups" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                                <FaComments /> Groups
                            </Link>
                            <Link to="/dashboard" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                                Dashboard
                            </Link>
                        </>
                    )}
                </div>

                <div className={`navbar-actions ${mobileMenuOpen ? 'active' : ''}`}>
                    {user ? (
                        <>
                            <Link to="/projects/new" className="btn btn-primary btn-nav">
                                <FaPlus /> New Project
                            </Link>

                            <Link to="/notifications" className="nav-icon nav-icon-notification">
                                <FaBell />
                                {unreadCount > 0 && (
                                    <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                )}
                            </Link>

                            <Link to={`/profile/${user.id}`} className="nav-icon" title="Profile">
                                <FaUser />
                            </Link>

                            <div className="user-menu">
                                <button className="user-menu-trigger">
                                    <div className="user-avatar">
                                        {user.username?.[0]?.toUpperCase()}
                                    </div>
                                </button>
                                <div className="user-dropdown">
                                    <div className="user-dropdown-header">
                                        <span className="user-name">{user.username}</span>
                                        <span className="user-email">{user.email}</span>
                                    </div>
                                    <div className="user-dropdown-divider"></div>
                                    <Link to={`/profile/${user.id}`} className="dropdown-item">
                                        <FaUser /> View Profile
                                    </Link>
                                    <Link to="/dashboard" className="dropdown-item">
                                        <FaCog /> Dashboard
                                    </Link>
                                    <div className="user-dropdown-divider"></div>
                                    <button onClick={handleLogout} className="dropdown-item dropdown-item-logout">
                                        <FaSignOutAlt /> Logout
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="auth-buttons">
                            <Link to="/login" className="btn btn-outline btn-nav">
                                Login
                            </Link>
                            <Link to="/register" className="btn btn-primary btn-nav">
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
