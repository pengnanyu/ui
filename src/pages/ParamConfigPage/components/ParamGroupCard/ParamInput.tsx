import type { ParamItem } from '@/types';
import styles from './ParamInput.module.css';

interface ParamInputProps {
  param: ParamItem;
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
}

export function ParamInput({ param, onValueChange, onBlur }: ParamInputProps) {
  if (param.readonly) {
    return <span className={styles.dash}>—</span>;
  }

  const isHexType = param.dataType === 'hex' || param.dataType === '2hex' || param.dataType === 'hex2';
  const isIdType = param.dataType === 'id' || param.dataType === 'identifier';
  const isTimeType = param.dataType === 'time' || param.dataType === 'bcdtime';

  if (param.options && param.options.length > 0) {
    return (
      <select
        className={styles.select}
        value={String(param.value)}
        onChange={(e) => onValueChange(param.key, e.target.value)}
        onBlur={() => onBlur(param.key)}
      >
        {param.options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (isHexType || isIdType || isTimeType) {
    return (
      <input
        type="text"
        className={styles.input}
        value={String(param.value)}
        onChange={(e) => onValueChange(param.key, e.target.value)}
        onBlur={() => onBlur(param.key)}
      />
    );
  }

  return (
    <input
      type="number"
      className={styles.input}
      value={Number(param.value)}
      min={param.min}
      max={param.max}
      step={param.step ?? 1}
      onChange={(e) => onValueChange(param.key, e.target.value)}
      onBlur={() => onBlur(param.key)}
    />
  );
}