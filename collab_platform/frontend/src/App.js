import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import CreateProject from './pages/CreateProject';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Notifications from './pages/Notifications';
import Groups from './pages/Groups';
import GroupChat from './pages/GroupChat';
import './App.css';

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <Navbar />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/projects" element={<Projects />} />
                            <Route path="/projects/new" element={<CreateProject />} />
                            <Route path="/projects/:slug" element={<ProjectDetail />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/profile/:id" element={<Profile />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/groups" element={<Groups />} />
                            <Route path="/groups/:id" element={<GroupChat />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
