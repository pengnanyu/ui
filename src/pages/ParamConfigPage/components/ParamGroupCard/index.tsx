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
  const prevViewportHeightRef = useRef(window.visualViewport?.height ?? window.innerHeight);

  const scrollActiveInputIntoView = useCallback(() => {
    const input = activeInputRef.current;
    const wrap = tableWrapRef.current;
    if (!input || !wrap) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const inputRect = input.getBoundingClientRect();
    const vvBottom = vv.height;
    const margin = 60;
    if (inputRect.bottom > vvBottom - margin) {
      const overflow = inputRect.bottom - (vvBottom - margin);
      wrap.scrollTop += overflow;
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const prevH = prevViewportHeightRef.current;
      const currH = vv.height;
      prevViewportHeightRef.current = currH;
      const delta = prevH - currH;
      if (delta > 20 && activeInputRef.current) {
        const wrap = tableWrapRef.current;
        if (wrap) {
          wrap.scrollTop += delta;
        }
      }
      scrollActiveInputIntoView();
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [scrollActiveInputIntoView]);

  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        activeInputRef.current = target;
        prevViewportHeightRef.current = window.visualViewport?.height ?? window.innerHeight;
        requestAnimationFrame(scrollActiveInputIntoView);
        setTimeout(scrollActiveInputIntoView, 100);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target === activeInputRef.current) {
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
