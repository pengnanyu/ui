import type { ParamItem } from '@/types';
import { ParamInput } from './ParamInput';
import styles from './ParamRow.module.css';

interface ParamRowProps {
  param: ParamItem;
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
}

export function ParamRow({ param, onValueChange, onBlur }: ParamRowProps) {
  const hasPendingDiff = param.pendingImportValue !== undefined;
  return (
    <div className={`${styles.row} ${hasPendingDiff ? styles.rowPending : ''}`}>
      <span className={styles.name}>{param.label}</span>
      <span className={styles.currentValue}>{param.displayValue ?? String(param.value)}</span>
      <ParamInput param={param} onValueChange={onValueChange} onBlur={onBlur} hasPendingDiff={hasPendingDiff} />
      <span className={styles.unit}>{param.unit ?? ''}</span>
    </div>
  );
}
