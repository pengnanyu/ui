import { useState, useCallback, useEffect } from 'react';
import { useBmsStore } from '@/store/context';
import { SendFrameCard } from './components/SendFrameCard';
import styles from './ExtendedCommandPage.module.css';

export function ExtendedCommandPage() {
  const { protocolDb, protocolLoading, sendFrame, autoRead } = useBmsStore();
  const [prefilledHex] = useState<string | undefined>();

  const handleSendFrame = useCallback((frame: number[]) => {
    sendFrame(frame);
  }, [sendFrame]);

  useEffect(() => {
    if (protocolDb && !protocolLoading) {
      autoRead();
    }
  }, [protocolDb, protocolLoading, autoRead]);

  return (
    <div className={styles.container}>
      <SendFrameCard onSendFrame={handleSendFrame} prefilledHex={prefilledHex} />
    </div>
  );
}
