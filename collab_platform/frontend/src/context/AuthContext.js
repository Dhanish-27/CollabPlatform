import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const response = await axios.get('/api/users/me/');
            setUser(response.data);
        } catch (error) {
            console.error('Error fetching user:', error);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await axios.post('/api/users/login/', { email, password });
        const { access, user } = response.data;
        localStorage.setItem('token', access);
        setToken(access);
        setUser(user);
        return user;
    };

    const register = async (userData) => {
        const response = await axios.post('/api/users/', userData);
        return response.data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    const updateUser = (userData) => {
        setUser({ ...user, ...userData });
    };

    // Get current token (for WebSocket auth)
    const getAuthToken = () => {
        return token || localStorage.getItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser, getAuthToken }}>
            {children}
        </AuthContext.Provider>
    );
};
