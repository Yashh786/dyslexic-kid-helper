import React, { useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/profiles/login`, { username, password });
      if (response.data && response.data.access_token) {
        onLoginSuccess({
          token: response.data.access_token,
          profile: response.data.profile
        });
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Invalid username or password. Try "kid" / "kid123".');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2>Welcome! Please Login</h2>
        <input
          type="text"
          placeholder="Username (e.g., kid)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password (e.g., kid123)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn">Login</button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        <p style={{marginTop: '20px', color: '#666'}}>
            Hint: Use <b>kid/kid123</b> or <b>parent/parent123</b>
        </p>
      </form>
    </div>
  );
}

export default Login;