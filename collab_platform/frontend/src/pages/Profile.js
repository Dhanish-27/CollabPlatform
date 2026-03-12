import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaGithub, FaLinkedin, FaGlobe, FaStar, FaCheck, FaEdit, FaSave, FaTimes, FaEnvelope, FaUser, FaBriefcase, FaClock, FaTools, FaMedal } from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
    const { id } = useParams();
    const { user: currentUser, updateUser } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        try {
            const response = await axios.get(`/api/users/${id}/`);
            setProfile(response.data);
            setEditForm({
                bio: response.data.bio || '',
                skills: response.data.skills || [],
                experience_level: response.data.experience_level || 'beginner',
                availability_hours: response.data.availability_hours || 0,
                github_link: response.data.github_link || '',
                linkedin_link: response.data.linkedin_link || '',
                portfolio_link: response.data.portfolio_link || '',
            });
            setIsOwnProfile(currentUser?.id === parseInt(id));
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditToggle = () => {
        if (isEditing) {
            // Cancel editing - reset form
            setEditForm({
                bio: profile.bio || '',
                skills: profile.skills || [],
                experience_level: profile.experience_level || 'beginner',
                availability_hours: profile.availability_hours || 0,
                github_link: profile.github_link || '',
                linkedin_link: profile.linkedin_link || '',
                portfolio_link: profile.portfolio_link || '',
            });
        }
        setIsEditing(!isEditing);
        setError('');
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await axios.patch(`/api/users/${id}/`, editForm);
            setProfile(response.data);
            updateUser(response.data);
            setIsEditing(false);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleSkillAdd = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            e.preventDefault();
            const newSkill = e.target.value.trim();
            if (!editForm.skills.includes(newSkill)) {
                setEditForm({ ...editForm, skills: [...editForm.skills, newSkill] });
            }
            e.target.value = '';
        }
    };

    const handleSkillRemove = (skillToRemove) => {
        setEditForm({
            ...editForm,
            skills: editForm.skills.filter(skill => skill !== skillToRemove)
        });
    };

    const calculateProfileCompletion = () => {
        if (!profile) return 0;
        let score = 0;
        const total = 10;

        if (profile.username) score++;
        if (profile.bio) score++;
        if (profile.skills && profile.skills.length > 0) score++;
        if (profile.experience_level) score++;
        if (profile.github_link) score++;
        if (profile.linkedin_link) score++;
        if (profile.portfolio_link) score++;
        if (profile.availability_hours > 0) score++;
        if (profile.teamwork_rating > 0) score++;
        if (profile.reliability_rating > 0) score++;

        return Math.round((score / total) * 100);
    };

    if (loading) return <div className="loading">Loading profile...</div>;
    if (!profile) return <div className="error">User not found</div>;

    const profileCompletion = calculateProfileCompletion();

    return (
        <div className="profile-page">
            <div className="container">
                {/* Profile Header */}
                <div className="profile-header">
                    <div className="profile-avatar-large">
                        {profile.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="profile-header-info">
                        <div className="profile-name-row">
                            <h1>{profile.username}</h1>
                            {profile.is_verified_mentor && (
                                <span className="verified-badge">
                                    <FaCheck /> Verified Mentor
                                </span>
                            )}
                        </div>
                        <p className="profile-role">{profile.role || 'Collaborator'}</p>
                        <div className="profile-meta">
                            <span><FaEnvelope /> {profile.email}</span>
                            {profile.availability_hours > 0 && (
                                <span><FaClock /> {profile.availability_hours} hrs/week available</span>
                            )}
                        </div>
                    </div>
                    {isOwnProfile && (
                        <div className="profile-actions">
                            {isEditing ? (
                                <>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        <FaSave /> {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={handleEditToggle}
                                        disabled={saving}
                                    >
                                        <FaTimes /> Cancel
                                    </button>
                                </>
                            ) : (
                                <button className="btn btn-primary" onClick={handleEditToggle}>
                                    <FaEdit /> Edit Profile
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {error && <div className="error-banner">{error}</div>}

                <div className="profile-content">
                    {/* Main Content */}
                    <div className="profile-main">
                        {/* About Section */}
                        <section className="profile-section">
                            <div className="section-header">
                                <h2>About</h2>
                            </div>
                            {isEditing ? (
                                <textarea
                                    className="edit-textarea"
                                    value={editForm.bio}
                                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                    placeholder="Tell us about yourself..."
                                    rows={4}
                                />
                            ) : (
                                <p className="about-text">{profile.bio || 'No bio provided yet.'}</p>
                            )}
                        </section>

                        {/* Skills Section */}
                        <section className="profile-section">
                            <div className="section-header">
                                <h2><FaTools /> Skills</h2>
                            </div>
                            {isEditing ? (
                                <div className="skills-edit">
                                    <div className="skills-list">
                                        {editForm.skills.map((skill, index) => (
                                            <span key={index} className="skill-tag">
                                                {skill}
                                                <button
                                                    className="skill-remove"
                                                    onClick={() => handleSkillRemove(skill)}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Type skill and press Enter..."
                                        onKeyPress={handleSkillAdd}
                                        className="skill-input"
                                    />
                                </div>
                            ) : (
                                <div className="skills-list">
                                    {profile.skills?.length > 0 ? (
                                        profile.skills.map((skill, index) => (
                                            <span key={index} className="skill-tag">{skill}</span>
                                        ))
                                    ) : (
                                        <p className="empty-text">No skills added yet.</p>
                                    )}
                                </div>
                            )}
                        </section>

                        {/* Experience & Availability */}
                        <section className="profile-section">
                            <div className="section-header">
                                <h2><FaBriefcase /> Experience & Availability</h2>
                            </div>
                            <div className="experience-grid">
                                <div className="experience-item">
                                    <span className="experience-label">Experience Level</span>
                                    {isEditing ? (
                                        <select
                                            value={editForm.experience_level}
                                            onChange={(e) => setEditForm({ ...editForm, experience_level: e.target.value })}
                                            className="edit-select"
                                        >
                                            <option value="beginner">Beginner</option>
                                            <option value="intermediate">Intermediate</option>
                                            <option value="advanced">Advanced</option>
                                            <option value="expert">Expert</option>
                                        </select>
                                    ) : (
                                        <span className={`experience-level ${profile.experience_level}`}>
                                            {profile.experience_level}
                                        </span>
                                    )}
                                </div>
                                <div className="experience-item">
                                    <span className="experience-label">Weekly Availability</span>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editForm.availability_hours}
                                            onChange={(e) => setEditForm({ ...editForm, availability_hours: parseInt(e.target.value) || 0 })}
                                            className="edit-input"
                                            min="0"
                                            max="168"
                                        />
                                    ) : (
                                        <span className="availability-value">
                                            {profile.availability_hours || 0} hours/week
                                        </span>
                                    )}
                                </div>
                                {profile.is_available_for_mentoring && (
                                    <div className="experience-item">
                                        <span className="mentoring-badge">Available for mentoring</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Links Section */}
                        <section className="profile-section">
                            <div className="section-header">
                                <h2>Links & Social</h2>
                            </div>
                            <div className="links-list">
                                {isEditing ? (
                                    <div className="links-edit">
                                        <div className="link-field">
                                            <FaGithub />
                                            <input
                                                type="url"
                                                value={editForm.github_link}
                                                onChange={(e) => setEditForm({ ...editForm, github_link: e.target.value })}
                                                placeholder="GitHub URL"
                                            />
                                        </div>
                                        <div className="link-field">
                                            <FaLinkedin />
                                            <input
                                                type="url"
                                                value={editForm.linkedin_link}
                                                onChange={(e) => setEditForm({ ...editForm, linkedin_link: e.target.value })}
                                                placeholder="LinkedIn URL"
                                            />
                                        </div>
                                        <div className="link-field">
                                            <FaGlobe />
                                            <input
                                                type="url"
                                                value={editForm.portfolio_link}
                                                onChange={(e) => setEditForm({ ...editForm, portfolio_link: e.target.value })}
                                                placeholder="Portfolio URL"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {profile.github_link && (
                                            <a href={profile.github_link} target="_blank" rel="noopener noreferrer" className="social-link">
                                                <FaGithub /> GitHub
                                            </a>
                                        )}
                                        {profile.linkedin_link && (
                                            <a href={profile.linkedin_link} target="_blank" rel="noopener noreferrer" className="social-link">
                                                <FaLinkedin /> LinkedIn
                                            </a>
                                        )}
                                        {profile.portfolio_link && (
                                            <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer" className="social-link">
                                                <FaGlobe /> Portfolio
                                            </a>
                                        )}
                                        {!profile.github_link && !profile.linkedin_link && !profile.portfolio_link && (
                                            <p className="empty-text">No links added yet.</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar */}
                    <div className="profile-sidebar">
                        <div className="completion-card">
                            <h3>Profile Completion</h3>
                            <div className="completion-ring">
                                <svg viewBox="0 0 36 36" className="circular-chart">
                                    <path className="circle-bg"
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path className="circle"
                                        strokeDasharray={`${profileCompletion}, 100`}
                                        d="M18 2.0845
                                        a 15.9155 15.9155 0 0 1 0 31.831
                                        a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <text x="19" y="22" className="percentage " style={{fontSize:"12px"}}>{profileCompletion}%</text>
                                </svg>
                            </div>
                            {profileCompletion < 100 && isOwnProfile && (
                                <p className="completion-tip">Complete your profile to get noticed!</p>
                            )}
                        </div>

                        {/* Stats Card */}
                        <div className="stats-card">
                            <h3><FaMedal /> Statistics</h3>
                            <div className="stat-item">
                                <span className="stat-label">Projects Joined</span>
                                <span className="stat-value">{profile.projects_joined_count || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Tasks Completed</span>
                                <span className="stat-value">{profile.tasks_completed_count || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Feedback Received</span>
                                <span className="stat-value">{profile.feedback_count || 0}</span>
                            </div>
                        </div>

                        {/* Ratings Card */}
                        <div className="ratings-card">
                            <h3><FaStar /> Ratings</h3>
                            <div className="rating-item">
                                <span className="rating-label">Teamwork</span>
                                <span className="rating-value">
                                    <FaStar className="star" />
                                    {profile.teamwork_rating?.toFixed(1) || '0.0'}
                                </span>
                            </div>
                            <div className="rating-item">
                                <span className="rating-label">Reliability</span>
                                <span className="rating-value">
                                    <FaStar className="star" />
                                    {profile.reliability_rating?.toFixed(1) || '0.0'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
