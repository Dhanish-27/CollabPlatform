import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FaSearch, FaFilter, FaUsers, FaCode, FaStar } from 'react-icons/fa';
import JoinRequestModal from '../components/JoinRequestModal';
import './Projects.css';

const Projects = React.memo(() => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [joinTarget, setJoinTarget] = useState(null); // project to join

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        difficulty: searchParams.get('difficulty') || '',
        status: searchParams.get('status') || ''
    });

    useEffect(() => {
        fetchProjects();
    }, [filters]);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.category) params.append('category', filters.category);
            if (filters.difficulty) params.append('difficulty', filters.difficulty);
            if (filters.status) params.append('status', filters.status);

            const response = await axios.get(`/api/projects/?${params.toString()}`);
            setProjects(response.data.results || response.data);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            search: '',
            category: '',
            difficulty: '',
            status: ''
        });
    }, []);

    return (
        <div className="projects-page">
            <div className="container">
                <div className="projects-header">
                    <h1>Explore Projects</h1>
                    <p>Find your next collaboration opportunity</p>
                </div>

                <div className="projects-filters">
                    <div className="search-box">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                    </div>

                    <div className="filter-group">
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                        >
                            <option value="">All Categories</option>
                            <option value="ai">AI</option>
                            <option value="web">Web Development</option>
                            <option value="mobile">Mobile</option>
                            <option value="ml">Machine Learning</option>
                            <option value="data">Data Science</option>
                            <option value="devops">DevOps</option>
                            <option value="blockchain">Blockchain</option>
                            <option value="game">Game Dev</option>
                            <option value="other">Other</option>
                        </select>

                        <select
                            value={filters.difficulty}
                            onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                        >
                            <option value="">All Levels</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                            <option value="expert">Expert</option>
                        </select>

                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="idea">Idea Stage</option>
                            <option value="accepting">Accepting Members</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>

                        <button onClick={clearFilters} className="btn btn-outline">
                            Clear Filters
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading">Loading projects...</div>
                ) : (
                    <>
                        <div className="projects-count">
                            {projects.length} projects found
                        </div>

                        <div className="projects-grid">
                            {projects.length > 0 ? (
                                projects.map((project) => (
                                    <Link to={`/projects/${project.slug}`} key={project.id} className="project-card">
                                        <div className="project-header">
                                            <span className="project-category">{project.category}</span>
                                            {project.is_featured && <FaStar className="featured-star" />}
                                        </div>

                                        <h3>{project.title}</h3>
                                        <p className="project-description">
                                            {project.description.slice(0, 120)}...
                                        </p>

                                        <div className="project-problem">
                                            <strong>Problem:</strong> {project.problem_statement.slice(0, 80)}...
                                        </div>

                                        <div className="project-meta">
                                            <span><FaUsers /> {project.member_count} members</span>
                                            <span className={`difficulty ${project.difficulty}`}>
                                                {project.difficulty}
                                            </span>
                                            <span className={`status ${project.status}`}>
                                                {project.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <div className="project-tech">
                                            {project.tech_stack?.slice(0, 4).map((tech, index) => (
                                                <span key={index} className="tech-tag">{tech}</span>
                                            ))}
                                        </div>

                                        {project.is_beginner_friendly && (
                                            <div className="beginner-badge">Beginner Friendly</div>
                                        )}

                                        {project.visibility === 'public' && (
                                            <button
                                                className="btn btn-sm btn-join"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setJoinTarget(project);
                                                }}
                                            >
                                                Request to Join
                                            </button>
                                        )}
                                    </Link>
                                ))
                            ) : (
                                <div className="no-projects">
                                    <p>No projects found matching your criteria.</p>
                                    <Link to="/projects/new" className="btn btn-primary">
                                        Create the first project
                                    </Link>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {joinTarget && (
                <JoinRequestModal
                    project={joinTarget}
                    onClose={() => setJoinTarget(null)}
                    onSuccess={() => {
                        setJoinTarget(null);
                        alert('Join request sent! The project owner will review it.');
                    }}
                />
            )}
        </div>
    );
});

Projects.displayName = 'Projects';
export default Projects;
