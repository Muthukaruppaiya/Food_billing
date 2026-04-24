import React from 'react';
import ROLES from '../data/roles';
import { useApp } from '../context/AppContext';
import './Sidebar.css';

export default function Sidebar({ children }) {
    const { role, username, handleLogout } = useApp();
    const currentRole = ROLES.find(r => r.key === role);

    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="logo-icon">🍽️</div>
                <h1>Resto<span>Bill</span></h1>
            </div>
            <div className="role-badge" style={{ '--role-color': currentRole.color }}>{currentRole.label} Panel</div>
            <nav className="nav-menu">{children}</nav>
            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="avatar" style={{ background: currentRole.color }}>{username.charAt(0).toUpperCase()}</div>
                    <span>{username}</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </aside>
    );
}
