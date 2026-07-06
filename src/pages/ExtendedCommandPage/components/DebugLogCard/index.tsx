import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBmsStore } from '@/store/context';
import { CardShell } from '@/components/shared/CardShell';
import type { DebugLogEntry } from '@/store/context';
import styles from './DebugLogCard.module.css';

type FilterType = 'all' | 'TX' | 'RX';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function DebugLogCard() {
  const { t } = useTranslation();
  const { debugLogs, clearLogs } = useBmsStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredLogs: DebugLogEntry[] = filter === 'all'
    ? debugLogs
    : debugLogs.filter(l => l.direction === filter);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  return (
    <CardShell
      title={t('command.debugLog')}
      titleExtra={
        <span style={{ fontSize: '11px', color: 'var(--color-muted-foreground)' }}>
          {filteredLogs.length}
        </span>
      }
    >
      <div className={styles.toolbar}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('command.filterAll')}
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'TX' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('TX')}
        >
          TX
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'RX' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('RX')}
        >
          RX
        </button>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
          />
          {t('command.autoScroll')}
        </label>
        <button className={styles.clearBtn} onClick={clearLogs}>
          {t('command.clearLogs')}
        </button>
      </div>
      <div className={styles.logContainer} ref={containerRef}>
        {filteredLogs.length === 0 ? (
          <div className={styles.emptyState}>{t('command.noLogs')}</div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className={styles.logEntry}>
              <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
              <span className={`${styles.logDir} ${log.direction === 'TX' ? styles.logDirTx : styles.logDirRx}`}>
                {log.direction}
              </span>
              <span className={styles.logInfo}>
                {log.parsedInfo ?? ''}
                {log.rawHex && (
                  <span className={styles.logHex}> {log.rawHex}</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </CardShell>
  );
}
