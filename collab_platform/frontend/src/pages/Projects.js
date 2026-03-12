import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { FaSearch, FaFilter, FaUsers, FaCode, FaStar, FaCheckCircle, FaPlusCircle, FaMinusCircle } from 'react-icons/fa';
import JoinRequestModal from '../components/JoinRequestModal';
import './Projects.css';

const Projects = () => {
    const { user } = useContext(AuthContext);
    const [projects, setProjects] = useState([]);
    const [myProjects, setMyProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const [joinTarget, setJoinTarget] = useState(null);
    const [activeTab, setActiveTab] = useState('available'); // 'available' or 'joined'

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        difficulty: searchParams.get('difficulty') || '',
        status: searchParams.get('status') || ''
    });

    useEffect(() => {
        fetchMyProjects();
    }, []);

    // Fetch available projects only after myProjects is loaded
    useEffect(() => {
        if (myProjects.length > 0 || !user) {
            fetchProjects();
        }
    }, [filters, activeTab, myProjects]);

    const fetchMyProjects = async () => {
        if (!user) {
            setMyProjects([]);
            return;
        }
        try {
            const response = await axios.get('/api/projects/my_projects/');
            setMyProjects(response.data);
        } catch (error) {
            console.error('Error fetching my projects:', error);
        }
    };

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.category) params.append('category', filters.category);
            if (filters.difficulty) params.append('difficulty', filters.difficulty);
            if (filters.status) params.append('status', filters.status);

            const response = await axios.get(`/api/projects/?${params.toString()}`);
            let allProjects = response.data.results || response.data;

            const myProjectIds = myProjects.map(p => p.id);

            // Filter based on active tab
            if (activeTab === 'available') {
                // Show projects user is NOT a member of
                allProjects = allProjects.filter(project =>
                    !myProjectIds.includes(project.id)
                );
            } else {
                // Show projects user IS a member of
                allProjects = allProjects.filter(project =>
                    myProjectIds.includes(project.id)
                );
            }

            setProjects(allProjects);
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

    const isUserMember = useCallback((projectId) => {
        return myProjects.some(p => p.id === projectId);
    }, [myProjects]);

    const handleJoinSuccess = () => {
        setJoinTarget(null);
        fetchMyProjects();
        fetchProjects();
    };

    return (
        <div className="projects-page">
            <div className="container">
                <div className="projects-header">
                    <h1>Explore Projects</h1>
                    <p>Find your next collaboration opportunity</p>
                </div>

                {/* Tab Navigation */}
                <div className="projects-tabs">
                    <button
                        className={`projects-tab ${activeTab === 'available' ? 'active' : ''}`}
                        onClick={() => setActiveTab('available')}
                    >
                        <FaMinusCircle /> Available Projects
                    </button>
                    <button
                        className={`projects-tab ${activeTab === 'joined' ? 'active' : ''}`}
                        onClick={() => setActiveTab('joined')}
                    >
                        <FaCheckCircle /> My Projects ({myProjects.length})
                    </button>
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
                            {projects.length} {projects.length === 1 ? 'project' : 'projects'} found
                            {activeTab === 'available' && user && myProjects.length > 0 && (
                                <span className="projects-filtered">
                                    <FaCheckCircle /> Showing projects you're not yet a member of
                                </span>
                            )}
                        </div>

                        <div className="projects-grid">
                            {projects.length > 0 ? (
                                projects.map((project) => (
                                    <div key={project.id} className="project-card">
                                        {/* Clicking project name opens join modal */}
                                        <div
                                            className="project-header-link"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (!isUserMember(project.id) && project.visibility === 'public') {
                                                    setJoinTarget(project);
                                                }
                                            }}
                                        >
                                            <Link to={`/projects/${project.slug}`}>
                                                <div className="project-header">
                                                    <span className="project-category">{project.category}</span>
                                                    {project.is_featured && <FaStar className="featured-star" />}
                                                </div>

                                                <h3>{project.title}</h3>
                                                <p className="project-description">
                                                    {project.description?.slice(0, 120)}...
                                                </p>

                                                <div className="project-problem">
                                                    <strong>Problem:</strong> {project.problem_statement?.slice(0, 80)}...
                                                </div>

                                                <div className="project-meta">
                                                    <span><FaUsers /> {project.member_count} members</span>
                                                    <span className={`difficulty ${project.difficulty}`}>
                                                        {project.difficulty}
                                                    </span>
                                                    <span className={`status ${project.status}`}>
                                                        {project.status?.replace('_', ' ')}
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
                                            </Link>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="project-actions">
                                            {activeTab === 'available' ? (
                                                project.visibility === 'public' && !isUserMember(project.id) && (
                                                    <button
                                                        className="btn btn-sm btn-join"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setJoinTarget(project);
                                                        }}
                                                    >
                                                        <FaPlusCircle /> Request to Join
                                                    </button>
                                                )
                                            ) : (
                                                <Link
                                                    to={`/projects/${project.slug}`}
                                                    className="btn btn-sm btn-view"
                                                >
                                                    <FaCode /> View Project
                                                </Link>
                                            )}

                                            {isUserMember(project.id) && activeTab === 'available' && (
                                                <span className="member-badge">
                                                    <FaCheckCircle /> Member
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-projects">
                                    <p>
                                        {activeTab === 'available'
                                            ? "No available projects found matching your criteria."
                                            : "You haven't joined any projects yet."}
                                    </p>
                                    {activeTab === 'joined' && (
                                        <Link to="/projects" className="btn btn-primary" onClick={() => setActiveTab('available')}>
                                            Explore Available Projects
                                        </Link>
                                    )}
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
                    onSuccess={handleJoinSuccess}
                />
            )}
        </div>
    );
};

export default Projects;
