import React from 'react';

function Header({ user, onLogout }) {
  return (
    <header className="app-header">
      <h1>Dyslexic Kid Helper 🧸</h1>
      {user && (
        <button className="btn" onClick={onLogout} style={{ position: 'absolute', top: '20px', right: '20px' }}>
          Logout
        </button>
      )}
    </header>
  );
}

export default Header;