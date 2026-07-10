/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 * Debug Log Card - 显示BLE通信调试日志（仅发送帧和返回数据）
 */
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import type { DebugLog } from '@/store/context';
import styles from './DebugLogCard.module.css';

interface DebugLogCardProps {
  logs: DebugLog[];
  onClear: () => void;
}

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

  // Show logs with hex data or label (includes time sync status messages)
  const dataLogs = logs.filter(l => (l.hex && l.hex.length > 0) || (l.label && l.label.length > 0));

  return (
    <CardShell title={t('command.debugLog')}>
      <div className={styles.logCard}>
        <div className={styles.logHeader}>
          <div className={styles.logHeaderLeft}>
            <span>{t('command.debugLog')}</span>
            <span className={styles.logCount}>{dataLogs.length}</span>
          </div>
          <button className={styles.clearBtn} onClick={onClear}>
            {t('command.clearLog')}
          </button>
        </div>
        <div className={styles.logList}>
          {dataLogs.length === 0 ? (
            <div className={styles.logEmpty}>{t('command.noLogs')}</div>
          ) : (
            dataLogs.map(log => (
              <div key={log.id} className={styles.logEntry}>
                <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                <span className={`${styles.logDir} ${log.direction === 'send' ? styles.logDirSend : styles.logDirRecv}`}>
                  {log.direction === 'send' ? t('command.send') : t('command.recv')}
                </span>
                {log.label && <span className={styles.logLabel}>{log.label}</span>}
                {log.hex && log.hex.length > 0 && <span className={styles.logHex}>{log.hex}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </CardShell>
  );
}
