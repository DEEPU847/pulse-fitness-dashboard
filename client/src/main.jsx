import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './styles.css';
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'google-client-id-not-configured';
createRoot(document.getElementById('root')).render(<React.StrictMode><GoogleOAuthProvider clientId={googleClientId}><App /></GoogleOAuthProvider></React.StrictMode>);
