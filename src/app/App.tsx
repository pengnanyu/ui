/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useCallback, useState, useEffect } from 'react';
import { Nav } from '@/components/shared/Nav';
import { BatteryInfoPage } from '@/pages/BatteryInfoPage';
import { ParamConfigPage } from '@/pages/ParamConfigPage';
import { FaultRecordPage } from '@/pages/FaultRecordPage';
import { ExtendedCommandPage } from '@/pages/ExtendedCommandPage';
import { useBmsStore } from '@/store/context';
import { Providers } from './providers';

const pages = [
  { path: '/battery', element: BatteryInfoPage },
  { path: '/params', element: ParamConfigPage },
  { path: '/faults', element: FaultRecordPage },
  { path: '/commands', element: ExtendedCommandPage },
];

function AppContent() {
  const [activePath, setActivePath] = useState('/battery');
  const { toasts } = useBmsStore();

  // Handle keyboard push-up: when the visual viewport changes (keyboard appears),
  // update --vh so the layout shrinks and content is pushed above the keyboard.
  useEffect(() => {
    const setVh = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--vh', `${vh / 100}px`);
    };
    setVh();
    window.visualViewport?.addEventListener('resize', setVh);
    window.visualViewport?.addEventListener('scroll', setVh);
    window.addEventListener('resize', setVh);
    return () => {
      window.visualViewport?.removeEventListener('resize', setVh);
      window.visualViewport?.removeEventListener('scroll', setVh);
      window.removeEventListener('resize', setVh);
    };
  }, []);

  const handleNavigate = useCallback((path: string) => {
    setActivePath(path);
  }, []);

  return (
    <>
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}>
          {toasts.map(t => (
            <span key={t.id} style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              animation: 'toastIn 0.25s ease-out',
              background: t.type === 'success' ? 'rgb(220,252,231)' : 'rgb(254,226,226)',
              color: t.type === 'success' ? 'rgb(22,101,52)' : 'rgb(153,27,27)',
            }}>
              {t.message}
            </span>
          ))}
        </div>
      )}
      <main style={{ position: 'sticky', top: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', height: 'calc(var(--vh, 1vh) * 100)', paddingBottom: 'calc(52px + env(safe-area-inset-bottom, 0px))', minHeight: 0, zIndex: 1, overflow: 'hidden' }}>
        {pages.map(({ path, element: Page }) => (
          <div key={path} style={{ display: path === activePath ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
            <Page />
          </div>
        ))}
      </main>
      <Nav
        activeRoute={activePath}
        onNavigate={handleNavigate}
      />
    </>
  );
}

export function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}
