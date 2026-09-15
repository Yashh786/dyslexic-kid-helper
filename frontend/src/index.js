import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';

// ── Sentry error monitoring ────────────────────────────────────────────────────
// Enabled only when REACT_APP_SENTRY_DSN is set in .env.
// Get a free DSN at https://sentry.io (5 000 errors/month free tier).
if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    // Capture 10% of page-load transactions for performance insights
    tracesSampleRate: 0.1,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);