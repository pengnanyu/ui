import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { ConnectionStatus, BridgeMessageType } from '@/types';
import { AppRouter, AppRoutes } from './routes';
import { Providers } from './providers';
import { Nav } from '@/components/shared/Nav';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/hooks/useLocale';
import { useBridgeMessage } from '@/hooks/useBridgeMessage';
import { isEmbedded } from '@/utils/platform';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { changeLanguage } = useLocale();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');

  const handlers: Partial<Record<BridgeMessageType, (payload: unknown) => void>> = {
    'bms:connection-status': (payload) => {
      const p = payload as { status: ConnectionStatus };
      setConnectionStatus(p.status);
    },
    'bms:theme-change': (payload) => {
      const p = payload as { theme: 'light' | 'dark' };
      setTheme(p.theme);
    },
    'bms:locale-change': (payload) => {
      const p = payload as { locale: 'zh' | 'en' };
      changeLanguage(p.locale);
    },
  };

  const { sendMessage } = useBridgeMessage({ handlers });

  useEffect(() => {
    if (isEmbedded()) {
      sendMessage({ type: 'bms:request-status', payload: {} });
    }
  }, [sendMessage]);

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
