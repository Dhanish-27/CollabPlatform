import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaGithub, FaLinkedin, FaGlobe, FaStar, FaCheck } from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
    const { id } = useParams();
    const { user: currentUser } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [id]);

    const fetchProfile = async () => {
        try {
            const response = await axios.get(`/api/users/${id}/`);
            setProfile(response.data);
            setIsOwnProfile(currentUser?.id === parseInt(id));
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading profile...</div>;
    if (!profile) return <div className="error">User not found</div>;

    return (
        <div className="profile-page">
            <div className="container">
                <div className="profile-header">
                    <div className="profile-avatar">
                        {profile.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <h1>{profile.username}</h1>
                        <p className="role">{profile.role}</p>
                        {profile.is_verified_mentor && (
                            <span className="verified-badge">
                                <FaCheck /> Verified Mentor
                            </span>
                        )}
                    </div>
                </div>

                <div className="profile-content">
                    <div className="profile-main">
                        <section className="profile-section">
                            <h2>About</h2>
                            <p>{profile.bio || 'No bio provided yet.'}</p>
                        </section>

                        <section className="profile-section">
                            <h2>Skills</h2>
                            <div className="skills-list">
                                {profile.skills?.length > 0 ? (
                                    profile.skills.map((skill, index) => (
                                        <span key={index} className="skill-tag">{skill}</span>
                                    ))
                                ) : (
                                    <p>No skills added yet.</p>
                                )}
                            </div>
                        </section>

                        <section className="profile-section">
                            <h2>Experience Level</h2>
                            <span className={`experience-level ${profile.experience_level}`}>
                                {profile.experience_level}
                            </span>
                        </section>

                        <section className="profile-section">
                            <h2>Links</h2>
                            <div className="links-list">
                                {profile.github_link && (
                                    <a href={profile.github_link} target="_blank" rel="noopener noreferrer">
                                        <FaGithub /> GitHub
                                    </a>
                                )}
                                {profile.linkedin_link && (
                                    <a href={profile.linkedin_link} target="_blank" rel="noopener noreferrer">
                                        <FaLinkedin /> LinkedIn
                                    </a>
                                )}
                                {profile.portfolio_link && (
                                    <a href={profile.portfolio_link} target="_blank" rel="noopener noreferrer">
                                        <FaGlobe /> Portfolio
                                    </a>
                                )}
                            </div>
                        </section>
                    </div>

                    <div className="profile-sidebar">
                        <div className="stats-card">
                            <h3>Stats</h3>
                            <div className="stat-item">
                                <span className="stat-label">Projects Joined</span>
                                <span className="stat-value">{profile.projects_joined_count || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Tasks Completed</span>
                                <span className="stat-value">{profile.tasks_completed_count || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Profile Completion</span>
                                <span className="stat-value">{profile.profile_completion || 0}%</span>
                            </div>
                        </div>

                        <div className="ratings-card">
                            <h3>Ratings</h3>
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

                        <div className="availability-card">
                            <h3>Availability</h3>
                            <p>{profile.availability_hours || 0} hours/week</p>
                            {profile.is_available_for_mentoring && (
                                <span className="mentoring-badge">Available for mentoring</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
