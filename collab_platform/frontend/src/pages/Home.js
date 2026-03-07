import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaSearch, FaUsers, FaCode, FaRocket, FaArrowRight } from 'react-icons/fa';
import './Home.css';

const Home = () => {
    const [featuredProjects, setFeaturedProjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchFeaturedProjects();
    }, []);

    const fetchFeaturedProjects = async () => {
        try {
            const response = await axios.get('/api/projects/featured/');
            setFeaturedProjects(response.data);
        } catch (error) {
            console.error('Error fetching featured projects:', error);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        window.location.href = `/projects?search=${searchTerm}`;
    };

    return (
        <div className="home">
            <section className="hero">
                <div className="hero-content">
                    <h1>Build Amazing Projects Together</h1>
                    <p>
                        Connect with developers, designers, and mentors to bring your ideas to life.
                        Collaborate on real-world projects and grow your skills.
                    </p>
                    <form onSubmit={handleSearch} className="search-form">
                        <div className="search-input-group">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search for projects, skills, or topics..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button type="submit" className="btn btn-primary">Search</button>
                        </div>
                    </form>
                </div>
            </section>

            <section className="features">
                <div className="container">
                    <h2>Why CollabHub?</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">
                                <FaUsers />
                            </div>
                            <h3>Find Your Team</h3>
                            <p>Connect with talented individuals who share your interests and skills.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <FaCode />
                            </div>
                            <h3>Build Real Projects</h3>
                            <p>Work on actual projects that matter and build your portfolio.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">
                                <FaRocket />
                            </div>
                            <h3>Grow Together</h3>
                            <p>Learn from mentors and peers while developing your skills.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="featured-projects">
                <div className="container">
                    <div className="section-header">
                        <h2>Featured Projects</h2>
                        <Link to="/projects" className="btn btn-outline">
                            View All <FaArrowRight />
                        </Link>
                    </div>
                    <div className="projects-grid">
                        {featuredProjects.length > 0 ? (
                            featuredProjects.map((project) => (
                                <Link to={`/projects/${project.slug}`} key={project.id} className="project-card">
                                    <div className="project-category">{project.category}</div>
                                    <h3>{project.title}</h3>
                                    <p>{project.description.slice(0, 100)}...</p>
                                    <div className="project-meta">
                                        <span>{project.member_count} members</span>
                                        <span className={`difficulty ${project.difficulty}`}>
                                            {project.difficulty}
                                        </span>
                                    </div>
                                    <div className="project-tech">
                                        {project.tech_stack?.slice(0, 3).map((tech, index) => (
                                            <span key={index} className="tech-tag">{tech}</span>
                                        ))}
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="no-projects">No featured projects yet. Be the first to create one!</p>
                        )}
                    </div>
                </div>
            </section>

            <section className="cta">
                <div className="container">
                    <h2>Ready to Start Collaborating?</h2>
                    <p>Join thousands of developers building amazing projects together.</p>
                    <Link to="/register" className="btn btn-primary btn-large">
                        Get Started Now
                    </Link>
                </div>
            </section>
        </div>
    );
};

export default Home;
