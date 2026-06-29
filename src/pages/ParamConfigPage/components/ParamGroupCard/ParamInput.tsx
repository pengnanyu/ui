import { useState, useCallback, useEffect, useRef } from 'react';
import type { ParamItem } from '@/types';
import styles from './ParamInput.module.css';

interface ParamInputProps {
  param: ParamItem;
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
}

const INTEGER_TYPES = new Set([
  'ushort', 'uint16', 'unsigned short',
  'short', 'int16', 'signed short',
  'uint', 'uint32', 'ulong', 'unsigned long', 'unsigned int',
  'int', 'int32', 'long', 'signed long', 'signed int',
  'uchar', 'unsigned char',
]);

const FLOAT_TYPES = new Set([
  'float', 'float32',
  'ushort Temper',
]);

const HEX_TYPES = new Set([
  'hex', '2hex', 'hex2', '2HEX', 'HEX',
]);

const ID_TYPES = new Set([
  'id', 'identifier', 'ID',
]);

const TIME_TYPES = new Set([
  'time', 'bcdtime', 'Time',
]);

function isIntegerType(dt: string): boolean {
  return INTEGER_TYPES.has(dt);
}

function isFloatType(dt: string): boolean {
  return FLOAT_TYPES.has(dt);
}

function isHexType(dt: string): boolean {
  return HEX_TYPES.has(dt);
}

function isIdType(dt: string): boolean {
  return ID_TYPES.has(dt);
}

function isTimeType(dt: string): boolean {
  return TIME_TYPES.has(dt);
}

function formatDisplayValue(value: number, dt: string): string {
  if (isFloatType(dt)) {
    const rounded = Math.round(value * 100) / 100;
    const s = rounded.toString();
    return s;
  }
  if (isIntegerType(dt)) {
    return Math.round(value).toString();
  }
  return value.toString();
}

export function ParamInput({ param, onValueChange, onBlur }: ParamInputProps) {
  const dt = param.dataType ?? '';
  const [localValue, setLocalValue] = useState(() =>
    formatDisplayValue(Number(param.value), dt)
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const paramKeyRef = useRef(param.key);
  paramKeyRef.current = param.key;

  useEffect(() => {
    if (inputRef.current !== document.activeElement) {
      setLocalValue(formatDisplayValue(Number(param.value), dt));
    }
  }, [param.value, dt]);

  const validateAndSanitize = useCallback((raw: string): string => {
    if (isHexType(dt)) {
      return raw.replace(/[^0-9a-fA-F ]/g, '');
    }
    if (isIdType(dt)) {
      return raw.replace(/[^0-9a-fA-F ]/g, '');
    }
    if (isTimeType(dt)) {
      return raw.replace(/[^0-9\-: /AMPW]/g, '');
    }
    if (isIntegerType(dt)) {
      let s = raw.replace(/[^0-9\-]/g, '');
      if (s.length > 1 && s.startsWith('--')) {
        s = '-' + s.slice(2);
      }
      return s;
    }
    if (isFloatType(dt)) {
      let s = raw.replace(/[^0-9.\-]/g, '');
      const firstDot = s.indexOf('.');
      if (firstDot >= 0) {
        s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
      }
      if (s.length > 1 && s.startsWith('--')) {
        s = '-' + s.slice(2);
      }
      if (dt === 'ushort Temper') {
        const dotIdx = s.indexOf('.');
        if (dotIdx >= 0 && s.length - dotIdx - 1 > 2) {
          s = s.slice(0, dotIdx + 3);
        }
      }
      return s;
    }
    return raw;
  }, [dt]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = validateAndSanitize(e.target.value);
    setLocalValue(sanitized);
  }, [validateAndSanitize]);

  const handleBlurInner = useCallback(() => {
    const sanitized = validateAndSanitize(localValue);
    let finalValue: string | number;
    if (isIntegerType(dt) || isFloatType(dt)) {
      const num = Number(sanitized);
      finalValue = isNaN(num) ? 0 : num;
      setLocalValue(formatDisplayValue(finalValue, dt));
      onValueChange(paramKeyRef.current, finalValue);
    } else {
      finalValue = sanitized;
      setLocalValue(sanitized);
      onValueChange(paramKeyRef.current, finalValue);
    }
    onBlur(paramKeyRef.current);
  }, [localValue, dt, validateAndSanitize, onValueChange, onBlur]);

  if (param.readonly) {
    return <span className={styles.dash}>—</span>;
  }

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

  const inputMode = isIntegerType(dt)
    ? 'numeric' as const
    : isFloatType(dt)
      ? 'decimal' as const
      : undefined;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={inputMode}
      className={styles.input}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlurInner}
    />
  );
}