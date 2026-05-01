import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing.js';
import { Architecture } from './pages/Architecture.js';
import { RemoteBoundary } from './components/RemoteBoundary.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/app" element={<RemoteBoundary />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
