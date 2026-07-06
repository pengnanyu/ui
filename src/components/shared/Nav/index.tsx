/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useTranslation } from 'react-i18next';
import styles from './Nav.module.css';

const ROUTES = [
  { path: '/battery', i18nKey: 'nav.batteryInfo', icon: 'battery' },
  { path: '/params', i18nKey: 'nav.paramConfig', icon: 'settings' },
  { path: '/faults', i18nKey: 'nav.faultRecord', icon: 'warning' },
  { path: '/commands', i18nKey: 'nav.extendedCommand', icon: 'signal' },
] as const;

function NavIcon({ name }: { name: string }) {
  const size = 20;
  switch (name) {
    case 'battery':
      return (
        <svg width={size} height={size} viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="18" height="10" rx="2" />
          <rect x="3" y="5" width="6" height="6" rx="0.5" fill="currentColor" opacity="0.8" />
          <path d="M21 7v2" strokeWidth="2" />
        </svg>
      );
    case 'settings':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'warning':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'signal':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 20h.01" />
          <path d="M7 20v-4" />
          <path d="M12 20v-8" />
          <path d="M17 20V8" />
          <path d="M22 4v16" />
        </svg>
      );
    default:
      return null;
  }
}

interface NavProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function Nav({ activeRoute, onNavigate }: NavProps) {
  const { t } = useTranslation();

  return (
    <nav className={styles.nav}>
      {ROUTES.map((route) => (
        <button
          key={route.path}
          className={`${styles.navItem} ${activeRoute === route.path ? styles.navItemActive : ''}`}
          onClick={() => onNavigate(route.path)}
        >
          <span className={styles.navIcon}><NavIcon name={route.icon} /></span>
          <span className={styles.navLabel}>{t(route.i18nKey)}</span>
        </button>
      ))}
    </nav>
  );
}
