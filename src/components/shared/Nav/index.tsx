import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from '@/types';
import { ConnectionIndicator } from './ConnectionIndicator';
import { NavItem } from './NavItem';
import styles from './Nav.module.css';

const ROUTES = [
  { path: '/battery', i18nKey: 'nav.batteryInfo' },
  { path: '/params', i18nKey: 'nav.paramConfig' },
  { path: '/faults', i18nKey: 'nav.faultRecord' },
  { path: '/commands', i18nKey: 'nav.extendedCommand' },
] as const;

interface NavProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  connectionStatus: ConnectionStatus;
}

export function Nav({ activeRoute, onNavigate, connectionStatus }: NavProps) {
  const { t } = useTranslation();

  const statusLabel = {
    connected: t('common.connected'),
    connecting: t('common.connecting'),
    disconnected: t('common.disconnected'),
    error: t('common.error'),
  }[connectionStatus];

  return (
    <nav className={styles.nav}>
      <ConnectionIndicator status={connectionStatus} label={statusLabel} />
      <div className={styles.navItems}>
        {ROUTES.map((route) => (
          <NavItem
            key={route.path}
            label={t(route.i18nKey)}
            active={activeRoute === route.path}
            onClick={() => onNavigate(route.path)}
          />
        ))}
      </div>
    </nav>
  );
}