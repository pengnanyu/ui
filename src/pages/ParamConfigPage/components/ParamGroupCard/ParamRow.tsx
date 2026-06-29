import type { ParamItem } from '@/types';
import styles from './ParamRow.module.css';

interface ParamRowProps {
  param: ParamItem;
}

export function ParamRow({ param }: ParamRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.name}>{param.label}</span>
      <span className={styles.currentValue}>{param.displayValue ?? String(param.value)}</span>
      <span className={styles.unit}>{param.unit ?? ''}</span>
    </div>
  );
}
