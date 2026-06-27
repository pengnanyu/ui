import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import { LogItem } from './LogItem';
import styles from './ReceiveLogCard.module.css';

export type LogFilter = 'all' | 'data-memory';

export interface LogEntry {
  id: string;
  timestamp: number;
  direction: 'TX' | 'RX';
  configType?: 'data-memory' | 'info-register' | 'calendar';
  parsedInfo?: string;
  rawHex: string;
}

interface ReceiveLogCardProps {
  logs: LogEntry[];
  filter: LogFilter;
  onFilterChange: (filter: LogFilter) => void;
}

export function ReceiveLogCard({ logs, filter, onFilterChange }: ReceiveLogCardProps) {
  const { t } = useTranslation();

  const filtered = filter === 'all'
    ? logs
    : logs.filter((l) => l.configType === 'data-memory');

  return (
    <CardShell title={t('command.receiveLog')}>
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => onFilterChange('all')}
        >
          {t('command.filterAll')}
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'data-memory' ? styles.filterBtnActive : ''}`}
          onClick={() => onFilterChange('data-memory')}
        >
          {t('command.filterDataMemory')}
        </button>
      </div>
      <div className={styles.logList}>
        {filtered.map((entry) => (
          <LogItem key={entry.id} entry={entry} />
        ))}
      </div>
    </CardShell>
  );
}