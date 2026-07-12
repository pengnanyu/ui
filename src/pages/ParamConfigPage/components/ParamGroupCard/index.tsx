/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParamItem } from '@/types';
import { ParamRow } from './ParamRow';
import styles from './ParamGroupCard.module.css';

interface ParamGroupCardProps {
  groupName: string;
  params: ParamItem[];
  onValueChange: (key: string, newValue: string | number) => void;
  onBlur: (key: string) => void;
  onBack?: () => void;
}

export function ParamGroupCard({ groupName, params, onValueChange, onBlur, onBack }: ParamGroupCardProps) {
  const { t } = useTranslation();
  const tableWrapRef = useRef<HTMLDivElement>(null);

  const handleFocusIn = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    const row = target.closest('[data-param-row]');
    if (!row) return;
    const scrollRowIntoView = () => {
      const wrapRect = wrap.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const margin = 40;
      if (rowRect.top < wrapRect.top + margin) {
        wrap.scrollTop -= (wrapRect.top + margin - rowRect.top);
      } else if (rowRect.bottom > wrapRect.bottom - margin) {
        wrap.scrollTop += (rowRect.bottom - wrapRect.bottom + margin);
      }
    };
    requestAnimationFrame(scrollRowIntoView);
    setTimeout(scrollRowIntoView, 300);
    setTimeout(scrollRowIntoView, 500);
  }, []);

  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    wrap.addEventListener('focusin', handleFocusIn);
    return () => wrap.removeEventListener('focusin', handleFocusIn);
  }, [handleFocusIn]);

  return (
    <div className={styles.group}>
      <div
        className={`${styles.groupHeader} ${onBack ? styles.groupHeaderClickable : ''}`}
        onClick={onBack}
      >
        {onBack && (
          <button
            className={styles.backBtn}
            onClick={(e) => { e.stopPropagation(); onBack(); }}
            aria-label="返回"
          >
            ‹
          </button>
        )}
        <span className={styles.groupTitle}>{groupName}</span>
      </div>
      <div className={styles.tableWrap} ref={tableWrapRef}>
        <div className={styles.table}>
          <div className={styles.rowHeader}>
            <span>{t('param.name')}</span>
            <span>{t('param.currentValue')}</span>
            <span>{t('param.setValue')}</span>
            <span>{t('param.unit')}</span>
          </div>
          <div className={styles.rowList}>
            {params.map((param) => (
              <ParamRow key={param.key} param={param} onValueChange={onValueChange} onBlur={onBlur} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
