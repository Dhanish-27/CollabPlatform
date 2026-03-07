import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './CreateProject.css';

const CreateProject = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        problem_statement: '',
        category: 'web',
        difficulty: 'intermediate',
        max_team_size: 5,
        required_roles: [],
        tech_stack: [],
        estimated_duration: '',
        visibility: 'public',
        is_beginner_friendly: false
    });

    const [techInput, setTechInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const addTech = (e) => {
        if (e.key === 'Enter' && techInput.trim()) {
            e.preventDefault();
            if (!formData.tech_stack.includes(techInput.trim())) {
                setFormData({
                    ...formData,
                    tech_stack: [...formData.tech_stack, techInput.trim()]
                });
            }
            setTechInput('');
        }
    };

    const removeTech = (tech) => {
        setFormData({
            ...formData,
            tech_stack: formData.tech_stack.filter(t => t !== tech)
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/api/projects/', formData);
            navigate(`/projects/${response.data.slug}`);
        } catch (err) {
            setError(err.response?.data?.title?.[0] || 'Failed to create project');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-project-page">
            <div className="container">
                <div className="create-project-card">
                    <h1>Create a New Project</h1>
                    <p>Share your idea and find collaborators</p>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="create-project-form">
                        <div className="form-section">
                            <h3>Basic Information</h3>

                            <div className="form-group">
                                <label>Project Title *</label>
                                <input
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter a catchy title for your project"
                                />
                            </div>

                            <div className="form-group">
                                <label>Problem Statement *</label>
                                <textarea
                                    name="problem_statement"
                                    value={formData.problem_statement}
                                    onChange={handleChange}
                                    required
                                    placeholder="What problem does this project solve?"
                                    rows={3}
                                />
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Describe your project in detail"
                                    rows={4}
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <h3>Project Details</h3>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Category</label>
                                    <select name="category" value={formData.category} onChange={handleChange}>
                                        <option value="ai">AI</option>
                                        <option value="web">Web Development</option>
                                        <option value="mobile">Mobile Development</option>
                                        <option value="ml">Machine Learning</option>
                                        <option value="data">Data Science</option>
                                        <option value="devops">DevOps</option>
                                        <option value="blockchain">Blockchain</option>
                                        <option value="game">Game Development</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Difficulty Level</label>
                                    <select name="difficulty" value={formData.difficulty} onChange={handleChange}>
                                        <option value="beginner">Beginner</option>
                                        <option value="intermediate">Intermediate</option>
                                        <option value="advanced">Advanced</option>
                                        <option value="expert">Expert</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Max Team Size</label>
                                    <input
                                        type="number"
                                        name="max_team_size"
                                        value={formData.max_team_size}
                                        onChange={handleChange}
                                        min={1}
                                        max={20}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Estimated Duration</label>
                                    <input
                                        type="text"
                                        name="estimated_duration"
                                        value={formData.estimated_duration}
                                        onChange={handleChange}
                                        placeholder="e.g., 3 months"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3>Tech Stack</h3>

                            <div className="form-group">
                                <label>Add Technologies (Press Enter)</label>
                                <input
                                    type="text"
                                    value={techInput}
                                    onChange={(e) => setTechInput(e.target.value)}
                                    onKeyDown={addTech}
                                    placeholder="e.g., React, Python, Django"
                                />
                                <div className="tech-tags">
                                    {formData.tech_stack.map((tech, index) => (
                                        <span key={index} className="tech-tag">
                                            {tech}
                                            <button type="button" onClick={() => removeTech(tech)}>×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3>Settings</h3>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="is_beginner_friendly"
                                        checked={formData.is_beginner_friendly}
                                        onChange={handleChange}
                                    />
                                    This project is beginner-friendly
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Visibility</label>
                                <select name="visibility" value={formData.visibility} onChange={handleChange}>
                                    <option value="public">Public - Anyone can find this project</option>
                                    <option value="private">Private - Only invited members</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Project'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateProject;
