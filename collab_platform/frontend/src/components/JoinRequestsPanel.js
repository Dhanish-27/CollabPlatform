/**
 * JoinRequestsPanel
 * =================
 * Displays pending join requests for all projects owned by the current user.
 * The owner can Approve or Reject each request.
 *
 * Usage: drop inside Dashboard.js
 *   <JoinRequestsPanel projects={myOwnedProjects} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './JoinRequestsPanel.css';

const JoinRequestsPanel = ({ projects = [] }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // request id being actioned

    const fetchRequests = useCallback(async () => {
        const validProjects = (projects || []).filter(Boolean);
        if (!validProjects.length) return;
        setLoading(true);
        try {
            // Fetch pending join requests for each owned project in parallel
            const results = await Promise.all(
                validProjects.map((p) =>
                    axios
                        .get(`/api/projects/${p.id}/join_requests/?status=pending`)
                        .then((res) => {
                            // Handle both plain array and paginated {results:[]} response
                            const data = Array.isArray(res.data)
                                ? res.data
                                : (res.data?.results || []);
                            return data.map((r) => ({ ...r, projectTitle: p.title, projectId: p.id }));
                        })
                        .catch(() => [])
                )
            );
            setRequests(results.flat().filter(Boolean));
        } finally {
            setLoading(false);
        }
    }, [projects]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = async (projectId, requestId, action) => {
        setActionLoading(requestId);
        try {
            await axios.post(`/api/projects/${projectId}/handle_join_request/`, {
                request_id: requestId,
                action, // 'accept' | 'reject'
            });
            // Remove from local list
            setRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err) {
            alert(err.response?.data?.error || 'Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="jrp-container">
                <h3 className="jrp-title">Join Requests</h3>
                <p className="jrp-empty">Loading…</p>
            </div>
        );
    }

    return (
        <div className="jrp-container">
            <h3 className="jrp-title">
                Join Requests
                {requests.length > 0 && (
                    <span className="jrp-badge">{requests.length}</span>
                )}
            </h3>

            {requests.length === 0 ? (
                <p className="jrp-empty">No pending join requests.</p>
            ) : (
                <ul className="jrp-list">
                    {requests.map((req) => (
                        <li key={req.id} className="jrp-item">
                            <div className="jrp-item-header">
                                <span className="jrp-applicant">
                                    {req.user?.username || req.user?.email || `User #${req.user}`}
                                </span>
                                <span className="jrp-project-tag">{req.projectTitle}</span>
                            </div>

                            <div className="jrp-role">
                                Role preference:{' '}
                                <strong>{req.role_preference || 'contributor'}</strong>
                            </div>

                            {req.message && (
                                <blockquote className="jrp-message">"{req.message}"</blockquote>
                            )}

                            <div className="jrp-actions">
                                <button
                                    className="jrp-btn jrp-btn-approve"
                                    disabled={actionLoading === req.id}
                                    onClick={() => handleAction(req.projectId, req.id, 'accept')}
                                >
                                    {actionLoading === req.id ? '…' : 'Approve'}
                                </button>
                                <button
                                    className="jrp-btn jrp-btn-reject"
                                    disabled={actionLoading === req.id}
                                    onClick={() => handleAction(req.projectId, req.id, 'reject')}
                                >
                                    {actionLoading === req.id ? '…' : 'Reject'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default JoinRequestsPanel;
