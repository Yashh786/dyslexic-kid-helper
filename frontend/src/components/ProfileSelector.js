import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileSelector.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function ProfileSelector({ onProfileSelected, onCreateNewProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/profiles`);
      setProfiles(response.data.profiles || []);
      setError('');
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Could not load profiles. Check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile);
    setPassword('');
    setDeletePassword('');
    setShowDeleteConfirm(false);
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!selectedProfile || !password) {
      setError('Please select a profile and enter password');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/profiles/login`, {
        username: selectedProfile.username,
        password: password
      });

      if (response.data && response.data.access_token) {
        // Pass the token and profile info to parent
        onProfileSelected({
          token: response.data.access_token,
          profile: response.data.profile
        });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
      setPassword('');
    }
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) return;
    
    if (!deletePassword) {
      setError('Please enter password to confirm deletion');
      return;
    }

    // Verify password before deleting
    try {
      const verifyResponse = await axios.post(`${API_URL}/api/profiles/login`, {
        username: selectedProfile.username,
        password: deletePassword
      });

      if (verifyResponse.data.access_token) {
        // Password is correct, proceed with deletion
        try {
          await axios.delete(`${API_URL}/api/profiles/${selectedProfile.id}`);
          setShowDeleteConfirm(false);
          setDeletePassword('');
          setSelectedProfile(null);
          setPassword('');
          await fetchProfiles();
          setError('');
        } catch (delErr) {
          setError('Could not delete profile. Please try again.');
        }
      }
    } catch (verifyErr) {
      setError('Incorrect password. Profile not deleted.');
      setDeletePassword('');
    }
  };

  if (loading) {
    return (
      <div className="profile-selector-container">
        <div className="profile-selector-card">
          <div className="loading">⏳ Loading profiles...</div>
        </div>
      </div>
    );
  }

  const canCreateMore = profiles.length < 3;

  return (
    <div className="profile-selector-container">
      <div className="profile-selector-card">
        <div className="header-section">
          <h1>🧸 LexiRead</h1>
          <p className="subtitle">Choose your profile to get started!</p>
        </div>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
          </div>
        )}

        {profiles.length === 0 ? (
          <div className="no-profiles-section">
            <p className="no-profiles-text">No profiles yet. Let's create your first one!</p>
            <button 
              className="btn btn-primary btn-large" 
              onClick={onCreateNewProfile}
            >
              ➕ Create First Profile
            </button>
          </div>
        ) : (
          <div className="main-content">
            <div className="profiles-section">
              <p className="section-label">📋 Available Profiles:</p>
              <div className="profiles-grid">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    className={`profile-card ${selectedProfile?.id === profile.id ? 'selected' : ''}`}
                    onClick={() => handleSelectProfile(profile)}
                  >
                    <div className="profile-avatar">👤</div>
                    <div className="profile-name">{profile.username}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedProfile && !showDeleteConfirm && (
              <form onSubmit={handleLogin} className="login-section">
                <p className="section-label">🔐 Enter Your Password:</p>
                <input
                  type="password"
                  placeholder="Type your password here"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin(e)}
                  className="password-input"
                  autoFocus
                />
                <div className="button-group">
                  <button type="submit" className="btn btn-primary btn-large">
                    ✓ Login
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    🗑️ Delete Profile
                  </button>
                </div>
              </form>
            )}

            {selectedProfile && showDeleteConfirm && (
              <div className="delete-confirm-section">
                <div className="warning-box">
                  <p className="warning-title">⚠️ Delete Profile?</p>
                  <p className="warning-text">
                    This will permanently delete the profile "
                    <strong>{selectedProfile.username}</strong>".
                  </p>
                  <p className="warning-subtext">
                    To confirm, please enter your password:
                  </p>
                </div>
                <input
                  type="password"
                  placeholder="Enter password to confirm deletion"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setError('');
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleDeleteProfile()}
                  className="password-input"
                  autoFocus
                />
                <div className="button-group">
                  <button
                    className="btn btn-danger btn-large"
                    onClick={handleDeleteProfile}
                  >
                    🗑️ Yes, Delete Profile
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword('');
                      setError('');
                    }}
                  >
                    ← Cancel
                  </button>
                </div>
              </div>
            )}

            {canCreateMore && !showDeleteConfirm && (
              <button
                className="btn btn-secondary btn-large"
                onClick={onCreateNewProfile}
              >
                ➕ Create Another Profile
              </button>
            )}

            {!canCreateMore && !showDeleteConfirm && (
              <p className="max-profiles-warning">
                ⚠️ You have reached the maximum of 3 profiles. Delete one to create a new profile.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfileSelector;
