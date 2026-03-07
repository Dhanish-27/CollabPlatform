/**
 * JoinRequestModal
 * ================
 * Modal form for submitting a join request to a public project.
 * The user must provide a message explaining why they want to join.
 *
 * Props:
 *   project   - project object { id, title, slug }
 *   onClose   - callback to close the modal
 *   onSuccess - callback after successful submission
 */

import React, { useState } from 'react';
import axios from 'axios';
import './JoinRequestModal.css';

const ROLE_OPTIONS = [
    { value: 'contributor', label: 'Contributor' },
    { value: 'maintainer', label: 'Maintainer' },
    { value: 'mentor', label: 'Mentor' },
    { value: 'observer', label: 'Observer' },
];

const JoinRequestModal = ({ project, onClose, onSuccess }) => {
    const [message, setMessage] = useState('');
    const [rolePreference, setRolePreference] = useState('contributor');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            setError('Please write a message explaining why you want to join.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await axios.post(`/api/projects/${project.id}/join/`, {
                message: message.trim(),
                role_preference: rolePreference,
            });
            onSuccess?.();
            onClose();
        } catch (err) {
            const detail =
                err.response?.data?.error ||
                err.response?.data?.detail ||
                'Failed to submit request. Please try again.';
            setError(detail);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="jrm-overlay" onClick={onClose}>
            <div className="jrm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="jrm-header">
                    <h2>Request to Join</h2>
                    <button className="jrm-close" onClick={onClose} aria-label="Close">
                        &times;
                    </button>
                </div>

                <p className="jrm-project-name">{project.title}</p>

                <form onSubmit={handleSubmit} className="jrm-form">
                    <div className="jrm-field">
                        <label htmlFor="jrm-role">Preferred Role</label>
                        <select
                            id="jrm-role"
                            value={rolePreference}
                            onChange={(e) => setRolePreference(e.target.value)}
                        >
                            {ROLE_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="jrm-field">
                        <label htmlFor="jrm-message">
                            Why do you want to join? <span className="jrm-required">*</span>
                        </label>
                        <textarea
                            id="jrm-message"
                            rows={5}
                            placeholder="Describe your skills, motivation, and what you can contribute..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={1000}
                            required
                        />
                        <span className="jrm-char-count">{message.length}/1000</span>
                    </div>

                    {error && <p className="jrm-error">{error}</p>}

                    <div className="jrm-actions">
                        <button type="button" className="jrm-btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="jrm-btn-submit" disabled={loading}>
                            {loading ? 'Sending…' : 'Send Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JoinRequestModal;
