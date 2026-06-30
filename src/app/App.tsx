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
      <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh', paddingBottom: '72px', overflow: 'hidden', minHeight: 0 }}>
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
