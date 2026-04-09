import React, { useState } from 'react';
import axios from 'axios';
import './ProfileCreator.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ProfileCreator({ onProfileCreated, onBackToSelector }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${API_URL}/api/profiles/create`, {
        username: username.trim(),
        password: password
      });

      if (response.data && response.data.access_token) {
        // Pass the token and profile info to parent
        onProfileCreated({
          token: response.data.access_token,
          profile: response.data.profile
        });
      }
    } catch (err) {
      console.error('Profile creation error:', err);
      setError(err.response?.data?.error || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-creator-container">
      <div className="profile-creator-card">
        <div className="header-section">
          <h1>🎯 Create Your Profile</h1>
          <p className="subtitle">Choose a username and password</p>
        </div>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
          </div>
        )}

        <form onSubmit={handleCreateProfile}>
          <div className="form-group">
            <label>👤 Username</label>
            <p className="field-hint">3 or more letters only</p>
            <input
              type="text"
              placeholder="Example: Alex or Maya"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              disabled={loading}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>🔐 Password</label>
            <p className="field-hint">4 or more characters</p>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>✓ Confirm Password</label>
            <p className="field-hint">Type your password again</p>
            <input
              type="password"
              placeholder="Type your password again"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError('');
              }}
              disabled={loading}
              className="form-input"
            />
          </div>

          <div className="button-group">
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading ? '⏳ Creating...' : '✓ Create Profile'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-large"
              onClick={onBackToSelector}
              disabled={loading}
            >
              ← Go Back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileCreator;
