/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import styles from './SendFrameCard.module.css';

interface SendFrameCardProps {
  onSendFrame: (frame: number[]) => void;
  prefilledHex?: string;
}

function parseHex(str: string): number[] | null {
  const parts = str.trim().split(/\s+/);
  const result: number[] = [];
  for (const part of parts) {
    if (!/^[0-9A-Fa-f]{1,2}$/.test(part)) return null;
    result.push(parseInt(part, 16));
  }
  return result.length > 0 ? result : null;
}

export function SendFrameCard({ onSendFrame, prefilledHex }: SendFrameCardProps) {
  const { t } = useTranslation();
  const [hex, setHex] = useState(prefilledHex ?? '');
  const [error, setError] = useState(false);

  const handleSend = () => {
    const frame = parseHex(hex);
    if (!frame) {
      setError(true);
      return;
    }
    setError(false);
    onSendFrame(frame);
  };

  const handleInitFrame = () => {
    setHex('00 03 00 00 00 03');
    setError(false);
  };

  const handleReadOneReg = () => {
    setHex('00 03 00 00 00 01');
    setError(false);
  };

  return (
    <CardShell title={t('command.sendFrame')}>
      <div className={styles.sendRow}>
        <input
          className={`${styles.hexInput} ${error ? styles.hexInputError : ''}`}
          value={hex}
          onChange={(e) => { setHex(e.target.value); setError(false); }}
          placeholder={t('command.hexInput')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
        />
        <button className={styles.sendBtn} onClick={handleSend}>
          {t('command.send')}
        </button>
      </div>
      <div className={styles.quickBtns}>
        <button className={styles.quickBtn} onClick={handleInitFrame}>
          {t('command.initFrame')}
        </button>
        <button className={styles.quickBtn} onClick={handleReadOneReg}>
          {t('command.readOneReg')}
        </button>
      </div>
      {error && <div className={styles.errorMsg}>{t('command.invalidHex')}</div>}
    </CardShell>
  );
}