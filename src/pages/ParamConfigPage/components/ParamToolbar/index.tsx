import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import styles from './ParamToolbar.module.css';

interface ParamToolbarProps {
  onReadParams: () => void;
  onBatchWrite: () => void;
  onImport: () => void;
  onExport: () => void;
  onPreset: (presetId: string) => void;
  reading?: boolean;
}

export function ParamToolbar({ onReadParams, onBatchWrite, onImport, onExport, onPreset, reading }: ParamToolbarProps) {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <div className={styles.toolbar}>
        <button className={styles.btnPrimary} onClick={onReadParams} disabled={reading}>
          {reading ? t('common.loading') : t('param.readParams')}
        </button>
        <button className={styles.btnDanger} onClick={() => setShowConfirm(true)}>
          {t('param.batchWrite')}
        </button>
        <button className={styles.btn} onClick={onImport}>
          {t('param.importConfig')}
        </button>
        <button className={styles.btn} onClick={onExport}>
          {t('param.exportConfig')}
        </button>
        <button className={styles.btn} onClick={() => onPreset('default')}>
          {t('param.preset')}
        </button>
      </div>
      <ConfirmDialog
        title={t('param.batchWrite')}
        message={t('param.confirmWrite')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { setShowConfirm(false); onBatchWrite(); }}
        onCancel={() => setShowConfirm(false)}
        visible={showConfirm}
      />
    </>
  );
}