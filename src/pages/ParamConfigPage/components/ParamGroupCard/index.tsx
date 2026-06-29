import { useTranslation } from 'react-i18next';
import type { ParamItem } from '@/types';
import { ParamRow } from './ParamRow';
import styles from './ParamGroupCard.module.css';

interface ParamGroupCardProps {
  groupName: string;
  params: ParamItem[];
  onBack?: () => void;
}

export function ParamGroupCard({ groupName, params, onBack }: ParamGroupCardProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} aria-label="返回">
            ‹
          </button>
        )}
        <span className={styles.groupTitle}>{groupName}</span>
      </div>
      <div className={styles.groupContent}>
        <div className={styles.rowHeader}>
          <span>{t('param.name')}</span>
          <span>{t('param.currentValue')}</span>
          <span>{t('param.unit')}</span>
        </div>
        <div className={styles.rowList}>
          {params.map((param) => (
            <ParamRow key={param.key} param={param} />
          ))}
        </div>
      </div>
    </div>
  );
}
