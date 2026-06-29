import type { ParamItem } from '@/types';
import { ParamInput } from './ParamInput';
import styles from './ParamRow.module.css';

interface ParamRowProps {
  param: ParamItem;
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
}

export function ParamRow({ param, onValueChange, onBlur }: ParamRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.name}>{param.label}</span>
      <span className={styles.currentValue}>{param.displayValue ?? String(param.value)}</span>
      <ParamInput param={param} onValueChange={onValueChange} onBlur={onBlur} />
      <span className={styles.unit}>{param.unit ?? ''}</span>
    </div>
  );
}
