import { useState, useCallback } from 'react';
import { useBmsStore } from '@/store/context';
import { SendFrameCard } from './components/SendFrameCard';
import { ReceiveLogCard, type LogFilter } from './components/ReceiveLogCard';
import { ProtocolDbCard } from './components/ProtocolDbCard';
import styles from './ExtendedCommandPage.module.css';

export function ExtendedCommandPage() {
  const { protocolDb, protocolLoading, logs, sendFrame, autoRead } = useBmsStore();
  const [prefilledHex, setPrefilledHex] = useState<string | undefined>();
  const [filter, setFilter] = useState<LogFilter>('all');

  const handleSendFrame = useCallback((frame: number[]) => {
    sendFrame(frame);
  }, [sendFrame]);

  const handleFillCommand = useCallback((hex: string) => {
    setPrefilledHex(hex);
  }, []);

  return (
    <div className={styles.container}>
      <SendFrameCard onSendFrame={handleSendFrame} prefilledHex={prefilledHex} />
      <ReceiveLogCard logs={logs} filter={filter} onFilterChange={setFilter} />
      <ProtocolDbCard
        database={protocolDb}
        loading={protocolLoading}
        onInitProtocol={() => { }}
        onLoadDatabase={() => { }}
        onAutoRead={autoRead}
        onFillCommand={handleFillCommand}
      />
    </div>
  );
}
