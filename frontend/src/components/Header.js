import React from 'react';

function Header({ profile, onLogout }) {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '20px' }}>
        <h1 style={{ margin: 0, textAlign: 'center', flex: 1 }}>LexiRead 🧸</h1>
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '8px 15px',
              borderRadius: '20px',
              backdropFilter: 'blur(5px)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3em',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}>
                👤
              </div>
              <span style={{ fontSize: '1.1em', color: 'white', fontWeight: 'bold', letterSpacing: '0.3px' }}>
                {profile.username}
              </span>
            </div>
            <button className="btn logout-btn" onClick={onLogout} style={{ margin: 0, padding: '10px 20px', fontSize: '1rem' }}>
              🚪 Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;