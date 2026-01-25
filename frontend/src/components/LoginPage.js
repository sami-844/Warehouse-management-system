// Login Page Component
import React, { useState } from 'react';
import { authAPI } from '../services/api';
import './LoginPage.css';

function LoginPage({ onLoginSuccess }) {
  // State to store form inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent page refresh
    setError(''); // Clear any previous errors
    setLoading(true); // Show loading state

    try {
      // Call login API
      const response = await authAPI.login(username, password);
      
      // Save token to localStorage
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      
      // Get user info
      const userResponse = await authAPI.getCurrentUser();
      localStorage.setItem('user', JSON.stringify(userResponse.data));
      
      // Success! Call parent component
      onLoginSuccess(userResponse.data);
      
    } catch (err) {
      // Handle errors
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false); // Hide loading state
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>🏭 Warehouse Management</h1>
          <h2>AK Al Momaiza Trading</h2>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>Test accounts:</p>
          <ul>
            <li>admin / admin123</li>
            <li>warehouse_mgr / warehouse123</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;