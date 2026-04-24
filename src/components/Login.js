import React, { useState } from 'react';
import api from '../services/api';
import { useApp } from '../context/AppContext';
import './Login.css';

export default function Login() {
    const { settings, setRole, setUsername } = useApp();
    const [usernameInput, setUsernameInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!usernameInput || !passwordInput) {
            setError('Please enter both username and password.');
            return;
        }

        setLoading(true);
        try {
            const user = await api.loginUser({ username: usernameInput, password: passwordInput });
            localStorage.setItem('X-Username', user.username);
            localStorage.setItem('X-Role', user.role);
            localStorage.setItem('X-UserId', user.id);
            setUsername(user.username);
            setRole(user.role);
        } catch (err) {
            setError('Invalid username or password.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <h2>{settings?.restaurantName || 'RestoBill'}</h2>
                    <p>Restaurant Management System</p>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    <p className="demo-subtitle">Login to your account</p>

                    {error && <div className="error-message">{error}</div>}

                    <div className="input-group">
                        <label>Username</label>
                        <input
                            type="text"
                            placeholder="e.g. waiter1"
                            value={usernameInput}
                            onChange={e => setUsernameInput(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter password"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="primary-btn" disabled={loading} style={{ width: '100%', marginTop: '20px' }}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>

                    <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                        <p style={{ fontSize: '0.9rem', color: '#666', textAlign: 'center', marginBottom: '10px' }}>Quick Login (Demo)</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button type="button" className="secondary-btn" onClick={() => { setUsernameInput('admin1'); setPasswordInput('password123'); }}>Admin</button>
                            <button type="button" className="secondary-btn" onClick={() => { setUsernameInput('waiter1'); setPasswordInput('password123'); }}>Waiter</button>
                            <button type="button" className="secondary-btn" onClick={() => { setUsernameInput('chef1'); setPasswordInput('password123'); }}>Chef</button>
                            <button type="button" className="secondary-btn" onClick={() => { setUsernameInput('billing1'); setPasswordInput('password123'); }}>Billing</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
