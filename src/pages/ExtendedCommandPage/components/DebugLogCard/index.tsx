/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 * Debug Log Card - 显示BLE通信调试日志
 */
import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import type { DebugLog } from '@/store/context';
import styles from './DebugLogCard.module.css';

interface DebugLogCardProps {
  logs: DebugLog[];
  onClear: () => void;
}

type FilterType = 'all' | 'send' | 'recv';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function DebugLogCard({ logs, onClear }: DebugLogCardProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === 'all' ? logs : logs.filter(l => l.direction === filter);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  return (
    <CardShell title={t('command.debugLog')}>
      <div className={styles.logCard}>
        <div className={styles.logHeader}>
          <div className={styles.logHeaderLeft}>
            <span>{t('command.debugLog')}</span>
            <span className={styles.logCount}>{logs.length}</span>
          </div>
          <button className={styles.clearBtn} onClick={onClear}>
            {t('command.clearLog')}
          </button>
        </div>
        <div className={styles.filterBtns}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('command.filterAll')}
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'send' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('send')}
          >
            {t('command.send')}
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'recv' ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter('recv')}
          >
            {t('command.recv')}
          </button>
          <button
            className={`${styles.filterBtn} ${autoScroll ? styles.filterBtnActive : ''}`}
            onClick={() => setAutoScroll(prev => !prev)}
          >
            {t('command.autoScroll')}
          </button>
        </div>
        <div className={styles.logList} ref={listRef}>
          {filteredLogs.length === 0 ? (
            <div className={styles.logEmpty}>{t('command.noLogs')}</div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className={styles.logEntry}>
                <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                <span className={`${styles.logDir} ${log.direction === 'send' ? styles.logDirSend : styles.logDirRecv}`}>
                  {log.direction === 'send' ? t('command.send') : t('command.recv')}
                </span>
                {log.label && <span className={styles.logLabel}>{log.label}</span>}
                <span className={styles.logHex}>{log.hex}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </CardShell>
  );
}
