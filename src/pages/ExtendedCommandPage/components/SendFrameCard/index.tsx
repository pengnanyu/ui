/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CardShell } from '@/components/shared/CardShell';
import { appendCrc } from '@/utils/modbus';
import styles from './SendFrameCard.module.css';

interface SendFrameCardProps {
  onSendFrame: (frame: number[]) => void;
  prefilledHex?: string;
}

/** Parse user hex input (without slave addr and CRC) into a complete frame */
function parseAndBuildFrame(str: string): number[] | null {
  const parts = str.trim().split(/[\s,]+/).filter(Boolean);
  const result: number[] = [];
  for (const part of parts) {
    if (!/^[0-9A-Fa-f]{1,2}$/.test(part)) return null;
    result.push(parseInt(part, 16));
  }
  if (result.length === 0) return null;
  // Prepend slave address 0x00
  const withAddr = [0x00, ...result];
  // Append CRC16
  return appendCrc(withAddr);
}

/** Format hex string for display: group by bytes with spaces */
function formatHexDisplay(str: string): string {
  const cleaned = str.replace(/[^0-9A-Fa-f]/g, '');
  return cleaned.replace(/(.{2})/g, '$1 ').trim().toUpperCase();
}

export function SendFrameCard({ onSendFrame, prefilledHex }: SendFrameCardProps) {
  const { t } = useTranslation();
  const [hex, setHex] = useState(prefilledHex ?? '');
  const [error, setError] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHex(e.target.value);
    setError(false);
  }, []);

  const handleSend = useCallback(() => {
    const frame = parseAndBuildFrame(hex);
    if (!frame) {
      setError(true);
      return;
    }
    setError(false);
    onSendFrame(frame);
  }, [hex, onSendFrame]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Show formatted preview of the complete frame
  const previewFrame = (() => {
    const frame = parseAndBuildFrame(hex);
    if (!frame) return '';
    return formatHexDisplay(frame.map(b => b.toString(16).padStart(2, '0')).join(''));
  })();

  return (
    <CardShell title={t('command.sendFrame')}>
      <div className={styles.inputArea}>
        <textarea
          className={`${styles.hexInput} ${error ? styles.hexInputError : ''}`}
          value={hex}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('command.hexInput')}
          rows={3}
          spellCheck={false}
          autoComplete="off"
        />
        <button className={styles.sendBtn} onClick={handleSend}>
          {t('command.send')}
        </button>
      </div>
      {previewFrame && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>→</span>
          <code className={styles.previewCode}>{previewFrame}</code>
        </div>
      )}
      {error && <div className={styles.errorMsg}>{t('command.invalidHex')}</div>}
    </CardShell>
  );
}
