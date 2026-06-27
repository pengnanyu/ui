import type { ConnectionStatus } from '@/types';
import styles from './Nav.module.css';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  label: string;
}

export function ConnectionIndicator({ status, label }: ConnectionIndicatorProps) {
  const dotClass = {
    connected: styles.dotConnected,
    connecting: styles.dotConnecting,
    disconnected: styles.dotDisconnected,
    error: styles.dotError,
  }[status];

  return (
    <div className={styles.connectionIndicator}>
      <span className={`${styles.dot} ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}