/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useState, useCallback, useEffect } from 'react';
import { useBmsStore } from '@/store/context';
import { SendFrameCard } from './components/SendFrameCard';
import { DebugLogCard } from './components/DebugLogCard';
import styles from './ExtendedCommandPage.module.css';

export function ExtendedCommandPage() {
  const { protocolDb, protocolLoading, sendManualFrame, autoRead, debugLogs, clearDebugLogs } = useBmsStore();
  const [prefilledHex] = useState<string | undefined>();

  const handleSendFrame = useCallback((frame: number[]) => {
    sendManualFrame(frame);
  }, [sendManualFrame]);

  useEffect(() => {
    if (protocolDb && !protocolLoading) {
      autoRead();
    }
  }, [protocolDb, protocolLoading, autoRead]);

  return (
    <div className={styles.container}>
      <SendFrameCard onSendFrame={handleSendFrame} prefilledHex={prefilledHex} />
      <DebugLogCard logs={debugLogs} onClear={clearDebugLogs} />
    </div>
  );
}
