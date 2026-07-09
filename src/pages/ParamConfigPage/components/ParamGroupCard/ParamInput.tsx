/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type { ParamItem } from '@/types';
import styles from './ParamInput.module.css';

interface ParamInputProps {
  param: ParamItem;
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
  hasPendingDiff?: boolean;
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

function sanitize(raw: string, dt: string): string {
  if (isHexType(dt) || isIdType(dt)) {
    return raw.replace(/[^0-9a-fA-F ]/g, '');
  }
  if (isTimeType(dt)) {
    return raw.replace(/[^0-9\-: /AMPW]/g, '');
  }
  if (isIntegerType(dt) || isFloatType(dt)) {
    let s = raw.replace(/[^0-9.\-]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot >= 0) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
    }
    if (s.length > 1 && s.startsWith('--')) {
      s = '-' + s.slice(2);
    }
    return s;
  }
  return raw;
}

export function ParamInput({ param, onValueChange, onBlur, hasPendingDiff }: ParamInputProps) {
  const dt = param.dataType ?? '';

  const formatImportValue = useCallback((val: number): string => {
    if (isHexType(dt)) {
      return val.toString(16).toUpperCase().padStart(param.byteLen === 1 ? 2 : 4, '0');
    }
    return String(val);
  }, [dt, param.byteLen]);

  const [localValue, setLocalValue] = useState(() => {
    if (param.pendingImportValue !== undefined) return formatImportValue(param.pendingImportValue);
    return param.displayValue ?? String(param.value);
  });
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const paramKeyRef = useRef(param.key);
  paramKeyRef.current = param.key;

  useEffect(() => {
    if (!isEditing) {
      if (param.pendingImportValue !== undefined) {
        setLocalValue(formatImportValue(param.pendingImportValue));
      } else {
        setLocalValue(param.displayValue ?? String(param.value));
      }
    }
  }, [param.displayValue, param.value, param.pendingImportValue, formatImportValue, isEditing]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(sanitize(e.target.value, dt));
  }, [dt]);

  const commitValue = useCallback(() => {
    const cleaned = sanitize(localValue, dt);
    let finalValue: string | number;
    if (isHexType(dt)) {
      const num = parseInt(cleaned, 16);
      finalValue = isNaN(num) ? 0 : num;
      setLocalValue(cleaned.toUpperCase());
      onValueChange(paramKeyRef.current, finalValue);
    } else if (isIntegerType(dt) || isFloatType(dt)) {
      const num = Number(cleaned);
      finalValue = isNaN(num) ? 0 : num;
      setLocalValue(String(finalValue));
      onValueChange(paramKeyRef.current, finalValue);
    } else {
      finalValue = cleaned;
      setLocalValue(cleaned);
      onValueChange(paramKeyRef.current, finalValue);
    }
    onBlur(paramKeyRef.current);
  }, [localValue, dt, onValueChange, onBlur]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      inputRef.current?.blur();
    }
  }, [commitValue]);

  const handleBlur = useCallback(() => {
    // On blur: revert to original value, do NOT write
    if (isEditing) {
      if (param.pendingImportValue !== undefined) {
        setLocalValue(formatImportValue(param.pendingImportValue));
      } else {
        setLocalValue(param.displayValue ?? String(param.value));
      }
      setIsEditing(false);
    }
  }, [isEditing, param.displayValue, param.value, param.pendingImportValue, formatImportValue]);

  const handleFocus = useCallback(() => {
    setIsEditing(true);
  }, []);

  if (param.readonly) {
    return <span className={styles.dash}>—</span>;
  }

  if (param.options && param.options.length > 0) {
    return (
      <select
        className={styles.select}
        value={String(param.value)}
        onChange={(e) => {
          onValueChange(param.key, e.target.value);
          onBlur(param.key);
        }}
      >
        {param.options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const inputMode = (isIntegerType(dt) || isFloatType(dt))
    ? 'decimal' as const
    : undefined;

  return (
    <div className={styles.inputWrap}>
      <input
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        enterKeyHint="done"
        className={`${styles.input} ${hasPendingDiff ? styles.inputPending : ''}`}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
