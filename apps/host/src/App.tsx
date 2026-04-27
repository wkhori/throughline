import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing.js';
import { Architecture } from './pages/Architecture.js';

const REMOTE_APP_URL = 'https://weekly-commit-remote-production.up.railway.app/';

function RemoteRedirect() {
  useEffect(() => {
    window.location.href = REMOTE_APP_URL;
  }, []);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/app" element={<RemoteRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
