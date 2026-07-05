import { useTranslation } from 'react-i18next';
import styles from './ParamToolbar.module.css';

interface ParamToolbarProps {
  onImport: () => void;
  onExport: () => void;
  onPreset: (presetId: string) => void;
  hasPendingImport?: boolean;
  isBatchWriting?: boolean;
  onConfirmImport?: () => void;
  onCancelImport?: () => void;
}

export function ParamToolbar({ onImport, onExport, onPreset, hasPendingImport, isBatchWriting, onConfirmImport, onCancelImport }: ParamToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.toolbar}>
      {hasPendingImport ? (
        <>
          <span className={styles.pendingHint}>{t('param.pendingImportHint')}</span>
          <div className={styles.spacer} />
          {!isBatchWriting && (
            <button className={styles.btnCancel} onClick={onCancelImport}>
              {t('param.cancelImport')}
            </button>
          )}
          <button className={styles.btnConfirm} onClick={onConfirmImport} disabled={isBatchWriting}>
            {isBatchWriting ? <span className={styles.spinner} /> : null}
            {isBatchWriting ? t('param.writing') : t('param.confirmImport')}
          </button>
        </>
      ) : (
        <>
          <div className={styles.spacer} />
          <button className={styles.btn} onClick={onImport}>
            {t('param.importConfig')}
          </button>
          <button className={styles.btn} onClick={onExport}>
            {t('param.exportConfig')}
          </button>
          <button className={styles.btn} onClick={() => onPreset('default')}>
            {t('param.preset')}
          </button>
        </>
      )}
    </div>
  );
}