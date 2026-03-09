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
import { FaUser, FaCheck, FaTimes, FaClock, FaEnvelope } from 'react-icons/fa';
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
        } catch (error) {
            console.error('Error fetching join requests:', error);
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

            // Show success message
            if (action === 'accept') {
                alert('Join request accepted! The user has been added to the project.');
            } else {
                alert('Join request rejected.');
            }

            // Refresh the list
            fetchRequests();
        } catch (err) {
            console.error('Error handling join request:', err);
            alert(err.response?.data?.error || 'Action failed. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="jrp-container">
                <h3 className="jrp-title">
                    <FaClock /> Join Requests
                </h3>
                <p className="jrp-empty">Loading requests...</p>
            </div>
        );
    }

    return (
        <div className="jrp-container">
            <h3 className="jrp-title">
                <FaEnvelope /> Join Requests
                {requests.length > 0 && (
                    <span className="jrp-badge">{requests.length}</span>
                )}
            </h3>

            {requests.length === 0 ? (
                <p className="jrp-empty">No pending join requests for your projects.</p>
            ) : (
                <div className="jrp-list">
                    {requests.map((req) => (
                        <div key={req.id} className="jrp-item">
                            <div className="jrp-item-header">
                                <div className="jrp-applicant">
                                    <FaUser className="user-icon" />
                                    <span>{req.user?.username || req.user?.email || `User #${req.user}`}</span>
                                </div>
                                <span className="jrp-project-tag">{req.projectTitle}</span>
                            </div>

                            <div className="jrp-details">
                                <div className="jrp-role">
                                    <strong>Role:</strong> {req.role_preference || 'contributor'}
                                </div>
                                {req.message && (
                                    <div className="jrp-message">
                                        <strong>Message:</strong> "{req.message}"
                                    </div>
                                )}
                            </div>

                            <div className="jrp-actions">
                                <button
                                    className="jrp-btn jrp-btn-approve"
                                    disabled={actionLoading === req.id}
                                    onClick={() => handleAction(req.projectId, req.id, 'accept')}
                                >
                                    {actionLoading === req.id ? (
                                        <FaClock className="spin" />
                                    ) : (
                                        <FaCheck />
                                    )} {actionLoading === req.id ? 'Processing...' : 'Accept'}
                                </button>
                                <button
                                    className="jrp-btn jrp-btn-reject"
                                    disabled={actionLoading === req.id}
                                    onClick={() => handleAction(req.projectId, req.id, 'reject')}
                                >
                                    {actionLoading === req.id ? (
                                        <FaClock className="spin" />
                                    ) : (
                                        <FaTimes />
                                    )} {actionLoading === req.id ? 'Processing...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JoinRequestsPanel;
