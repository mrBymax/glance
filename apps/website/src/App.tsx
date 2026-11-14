import { Route, Routes } from 'react-router';
import { KioskPage } from './kiosk/KioskPage';
import { MirrorPage } from './mirror/MirrorPage';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/kiosk" element={<KioskPage />} />
      <Route path="/mirror" element={<MirrorPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
