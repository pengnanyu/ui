import { useCallback, useState } from 'react';
import { Nav } from '@/components/shared/Nav';
import { BatteryInfoPage } from '@/pages/BatteryInfoPage';
import { ParamConfigPage } from '@/pages/ParamConfigPage';
import { FaultRecordPage } from '@/pages/FaultRecordPage';
import { ExtendedCommandPage } from '@/pages/ExtendedCommandPage';
import { Providers } from './providers';

const pages = [
  { path: '/battery', element: BatteryInfoPage },
  { path: '/params', element: ParamConfigPage },
  { path: '/faults', element: FaultRecordPage },
  { path: '/commands', element: ExtendedCommandPage },
];

function AppContent() {
  const [activePath, setActivePath] = useState('/battery');

  const handleNavigate = useCallback((path: string) => {
    setActivePath(path);
  }, []);

  return (
    <>
      <main style={{ position: 'sticky', top: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', height: 'calc(var(--vh, 1vh) * 100)', paddingBottom: '72px', overflow: 'hidden', minHeight: 0, zIndex: 1 }}>
        {pages.map(({ path, element: Page }) => (
          <div key={path} style={{ display: path === activePath ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column', overflow: 'hidden' }}>
            <Page />
          </div>
        ))}
      </main>
      <Nav
        activeRoute={activePath}
        onNavigate={handleNavigate}
      />
      <div style={{ height: '60px' }} aria-hidden="true" />
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
