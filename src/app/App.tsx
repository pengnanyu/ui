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
      <main className="flex flex-col min-h-0" style={{ height: '100vh', paddingBottom: '72px', overflow: 'hidden' }}>
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
