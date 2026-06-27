import type { LogEntry } from './index';
import styles from './LogItem.module.css';

interface LogItemProps {
  entry: LogEntry;
}

export function LogItem({ entry }: LogItemProps) {
  const time = new Date(entry.timestamp);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;

  const configTypeClass = entry.configType
    ? styles[entry.configType === 'data-memory' ? 'dm' : entry.configType === 'info-register' ? 'ir' : 'cl']
    : undefined;

  const configTypeLabel = entry.configType
    ? entry.configType === 'data-memory' ? 'DM' : entry.configType === 'info-register' ? 'IR' : 'CL'
    : undefined;

  return (
    <div className={styles.logItem}>
      <span className={styles.time}>{timeStr}</span>
      <span className={`${styles.direction} ${entry.direction === 'TX' ? styles.tx : styles.rx}`}>
        {entry.direction}
      </span>
      {configTypeLabel && configTypeClass && (
        <span className={`${styles.configType} ${configTypeClass}`}>{configTypeLabel}</span>
      )}
      {entry.parsedInfo && <span className={styles.parsed}>{entry.parsedInfo}</span>}
      <span className={styles.rawHex}>{entry.rawHex}</span>
    </div>
  );
}