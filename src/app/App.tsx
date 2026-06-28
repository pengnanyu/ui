import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AppRouter, AppRoutes } from './routes';
import { Providers } from './providers';
import { Nav } from '@/components/shared/Nav';
import { useBmsStore } from '@/store/context';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { connectionStatus } = useBmsStore();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <>
      <main style={{ paddingBottom: '72px' }}>
        <AppRoutes />
      </main>
      <Nav
        activeRoute={location.pathname}
        onNavigate={handleNavigate}
        connectionStatus={connectionStatus}
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
