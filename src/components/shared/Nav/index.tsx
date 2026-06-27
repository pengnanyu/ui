import { useTranslation } from 'react-i18next';
import type { ConnectionStatus } from '@/types';
import styles from './Nav.module.css';

const ROUTES = [
  { path: '/battery', i18nKey: 'nav.batteryInfo', icon: '🔋' },
  { path: '/params', i18nKey: 'nav.paramConfig', icon: '⚙️' },
  { path: '/faults', i18nKey: 'nav.faultRecord', icon: '⚠️' },
  { path: '/commands', i18nKey: 'nav.extendedCommand', icon: '📡' },
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

  const dotClass = {
    connected: styles.dotConnected,
    connecting: styles.dotConnecting,
    disconnected: styles.dotDisconnected,
    error: styles.dotError,
  }[connectionStatus];

  return (
    <>
      <div className={styles.connectionIndicator}>
        <span className={`${styles.dot} ${dotClass}`} />
        <span>{statusLabel}</span>
      </div>
      <nav className={styles.nav}>
        {ROUTES.map((route) => (
          <button
            key={route.path}
            className={`${styles.navItem} ${activeRoute === route.path ? styles.navItemActive : ''}`}
            onClick={() => onNavigate(route.path)}
          >
            <span className={styles.navIcon}>{route.icon}</span>
            <span className={styles.navLabel}>{t(route.i18nKey)}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
