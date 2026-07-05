import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProtocolDatabase } from '@/types';
import type { FieldValue } from '@/utils/modbus';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { DynamicTable } from './DynamicTable';
import styles from './ProtocolDbCard.module.css';

interface ProtocolDbCardProps {
  database: ProtocolDatabase | null;
  parsedValues: FieldValue[];
  onInitProtocol: () => void;
  onLoadDatabase: (version: string) => void;
  onAutoRead: () => void;
  onFillCommand: (hex: string) => void;
  loading?: boolean;
}

export function ProtocolDbCard({
  database,
  parsedValues,
  onInitProtocol,
  onLoadDatabase,
  onAutoRead,
  onFillCommand,
  loading,
}: ProtocolDbCardProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('');

  if (loading && !database) return <LoadingSkeleton variant="card" />;

  return (
    <CardShell title={t('command.protocolDb')}>
      <div className={styles.actionRow}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onInitProtocol}>
          {t('command.initProtocol')}
        </button>
        <input
          className={styles.versionInput}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder={t('command.version')}
        />
        <button className={styles.btn} onClick={() => version && onLoadDatabase(version)}>
          {t('command.loadDb')}
        </button>
        <button className={styles.btn} onClick={onAutoRead}>
          {t('command.autoRead')}
        </button>
      </div>
      {database && <DynamicTable database={database} parsedValues={parsedValues} onFillCommand={onFillCommand} />}
    </CardShell>
  );
}