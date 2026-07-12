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
  const activeInputRef = useRef<HTMLElement | null>(null);

  const scrollActiveInputIntoView = useCallback(() => {
    const input = activeInputRef.current;
    const wrap = tableWrapRef.current;
    if (!input || !wrap) return;
    const vv = window.visualViewport;
    const viewBottom = vv ? vv.height : window.innerHeight;
    const inputRect = input.getBoundingClientRect();
    const margin = 80;
    if (inputRect.bottom > viewBottom - margin) {
      const overflow = inputRect.bottom - (viewBottom - margin);
      wrap.scrollTop += overflow;
    }
  }, []);

  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        activeInputRef.current = target;
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollActiveInputIntoView);
        });
        setTimeout(scrollActiveInputIntoView, 150);
        setTimeout(scrollActiveInputIntoView, 400);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      if ((e.target as HTMLElement) === activeInputRef.current) {
        activeInputRef.current = null;
      }
    };

    wrap.addEventListener('focusin', onFocusIn);
    wrap.addEventListener('focusout', onFocusOut);
    return () => {
      wrap.removeEventListener('focusin', onFocusIn);
      wrap.removeEventListener('focusout', onFocusOut);
    };
  }, [scrollActiveInputIntoView]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onViewportChange = () => {
      if (activeInputRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(scrollActiveInputIntoView);
        });
      }
    };

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
    };
  }, [scrollActiveInputIntoView]);

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
