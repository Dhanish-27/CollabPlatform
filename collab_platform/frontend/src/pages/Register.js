import React, { useState, useContext, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import './Auth.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const Register = () => {
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        github_username: '',
        password: '',
        password_confirm: '',
        role: 'developer'
    });
    const [error, setError] = useState('');
    const [githubStatus, setGithubStatus] = useState({
        state: 'idle',   // 'idle' | 'checking' | 'valid' | 'invalid'
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register } = useContext(AuthContext);
    const navigate = useNavigate();
    const debounceTimer = useRef(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'github_username') {
            setGithubStatus({ state: 'idle', message: '' });
            clearTimeout(debounceTimer.current);
            if (value.trim()) {
                debounceTimer.current = setTimeout(() => validateGitHubUsername(value.trim()), 700);
            }
        }
    };

    const validateGitHubUsername = useCallback(async (username) => {
        setGithubStatus({ state: 'checking', message: '' });
        try {
            const res = await axios.post(`${API_BASE}/users/validate-github-username/`, {
                github_username: username
            });
            if (res.data.valid) {
                // Use canonical casing from GitHub (e.g. 'Dhanish-27')
                const canonical = res.data.canonical || username;
                // Update form data to store the canonical username
                setFormData(prev => ({ ...prev, github_username: canonical }));
                setGithubStatus({
                    state: 'valid',
                    message: res.data.warning || `✓ GitHub user "${canonical}" found!`
                });
            } else {
                setGithubStatus({ state: 'invalid', message: res.data.error });
            }
        } catch (err) {
            const errMsg = err.response?.data?.error || 'Could not verify GitHub username. Please try again.';
            setGithubStatus({ state: 'invalid', message: errMsg });
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.password_confirm) {
            setError('Passwords do not match');
            return;
        }

        if (githubStatus.state === 'invalid') {
            setError('Please fix the GitHub username before submitting.');
            return;
        }

        if (githubStatus.state === 'idle' || githubStatus.state === 'checking') {
            await validateGitHubUsername(formData.github_username.trim());
            if (githubStatus.state !== 'valid') {
                setError('Please wait for GitHub username validation to complete.');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await register(formData);
            navigate('/login');
        } catch (err) {
            const data = err.response?.data || {};
            setError(
                data.github_username?.[0] ||
                data.email?.[0] ||
                data.password?.[0] ||
                data.username?.[0] ||
                data.non_field_errors?.[0] ||
                'Registration failed. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const githubInputClass = () => {
        if (githubStatus.state === 'valid') return 'github-input valid';
        if (githubStatus.state === 'invalid') return 'github-input invalid';
        if (githubStatus.state === 'checking') return 'github-input checking';
        return 'github-input';
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <h1>Create Account</h1>
                    <p>Join CollabHub and start collaborating</p>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                placeholder="Enter your email"
                            />
                        </div>

                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                placeholder="Choose a display name"
                            />
                        </div>

                        {/* GitHub Username — validated against GitHub API */}
                        <div className="form-group">
                            <label>
                                GitHub Username
                                <span className="field-required"> *</span>
                            </label>
                            <div className="github-input-wrapper">
                                <span className="github-prefix">github.com/</span>
                                <input
                                    type="text"
                                    name="github_username"
                                    value={formData.github_username}
                                    onChange={handleChange}
                                    required
                                    placeholder="yourusername"
                                    className={githubInputClass()}
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                                {githubStatus.state === 'checking' && (
                                    <span className="github-status-icon checking-spinner">⟳</span>
                                )}
                                {githubStatus.state === 'valid' && (
                                    <span className="github-status-icon valid-icon">✓</span>
                                )}
                                {githubStatus.state === 'invalid' && (
                                    <span className="github-status-icon invalid-icon">✗</span>
                                )}
                            </div>
                            {githubStatus.message && (
                                <p className={`github-status-msg ${githubStatus.state}`}>
                                    {githubStatus.message}
                                </p>
                            )}
                            <small className="field-hint">
                                Must be an existing GitHub account. This is used to add you as a collaborator on project repositories.
                            </small>
                        </div>

                        <div className="form-group">
                            <label>I am a...</label>
                            <select name="role" value={formData.role} onChange={handleChange}>
                                <option value="student">Student</option>
                                <option value="developer">Developer</option>
                                <option value="mentor">Mentor</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                placeholder="Create a password"
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                name="password_confirm"
                                value={formData.password_confirm}
                                onChange={handleChange}
                                required
                                placeholder="Confirm your password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={isSubmitting || githubStatus.state === 'checking' || githubStatus.state === 'invalid'}
                        >
                            {isSubmitting ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
