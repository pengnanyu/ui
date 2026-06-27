import { useState, useCallback } from 'react';
import type { ProtocolDatabase } from '@/types';
import { SendFrameCard } from './components/SendFrameCard';
import { ReceiveLogCard, type LogEntry, type LogFilter } from './components/ReceiveLogCard';
import { ProtocolDbCard } from './components/ProtocolDbCard';
import styles from './ExtendedCommandPage.module.css';

export function ExtendedCommandPage() {
  const [prefilledHex, setPrefilledHex] = useState<string | undefined>();
  const [logs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [database] = useState<ProtocolDatabase | null>(null);

  const handleSendFrame = useCallback((_frame: number[]) => { }, []);
  const handleFillCommand = useCallback((hex: string) => {
    setPrefilledHex(hex);
  }, []);

  return (
    <div className={styles.container}>
      <SendFrameCard onSendFrame={handleSendFrame} prefilledHex={prefilledHex} />
      <ReceiveLogCard logs={logs} filter={filter} onFilterChange={setFilter} />
      <ProtocolDbCard
        database={database}
        onInitProtocol={() => { }}
        onLoadDatabase={() => { }}
        onAutoRead={() => { }}
        onFillCommand={handleFillCommand}
      />
    </div>
  );
}