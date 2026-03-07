import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaGithub, FaBell, FaUser, FaSignOutAlt, FaPlus, FaComments } from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <span className="brand-icon">🚀</span>
                    <span className="brand-text">CollabHub</span>
                </Link>

                <div className="navbar-links">
                    <Link to="/projects" className="nav-link">Explore Projects</Link>
                    {user && (
                        <>
                            <Link to="/groups" className="nav-link">
                                <FaComments /> Groups
                            </Link>
                            <Link to="/dashboard" className="nav-link">Dashboard</Link>
                        </>
                    )}
                </div>

                <div className="navbar-actions">
                    {user ? (
                        <>
                            <Link to="/projects/new" className="btn btn-primary">
                                <FaPlus /> New Project
                            </Link>
                            <Link to="/notifications" className="nav-icon">
                                <FaBell />
                            </Link>
                            <Link to={`/profile/${user.id}`} className="nav-icon">
                                <FaUser />
                            </Link>
                            <button onClick={handleLogout} className="nav-icon btn-logout">
                                <FaSignOutAlt />
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-outline">Login</Link>
                            <Link to="/register" className="btn btn-primary">Sign Up</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
