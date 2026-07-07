/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
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
      <div className={styles.groupContent}>
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
  );
}
