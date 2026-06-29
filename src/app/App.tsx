import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppRouter, AppRoutes } from './routes';
import { Providers } from './providers';
import { Nav } from '@/components/shared/Nav';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <>
      <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: '72px', overflow: 'hidden', minHeight: 0 }}>
        <AppRoutes />
      </main>
      <Nav
        activeRoute={location.pathname}
        onNavigate={handleNavigate}
      />
    </>
  );
}

export function App() {
  return (
    <Providers>
      <AppRouter>
        <AppContent />
      </AppRouter>
    </Providers>
  );
}
