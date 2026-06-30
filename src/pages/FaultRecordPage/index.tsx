import { useCallback } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { CalendarRecord } from '@/utils/modbus';
import styles from './FaultRecordPage.module.css';

export function FaultRecordPage() {
  const { calendarGroups, calendarRecords, readCalendar } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';

  const nonEmptyRecords = calendarRecords.filter(r => !r.isEmpty);

  const handleExport = useCallback(() => {
    if (calendarGroups.length === 0 || nonEmptyRecords.length === 0) return;

    const BOM = '\uFEFF';
    let csv = '';

    for (let gIdx = 0; gIdx < calendarGroups.length; gIdx++) {
      const group = calendarGroups[gIdx]!;
      const groupRecords = nonEmptyRecords.filter(r => r.groupIdx === gIdx);
      if (groupRecords.length === 0) continue;

      const groupName = isZh ? group.configNameZh : group.configNameEn;
      csv += groupName + '\n';

      const headers = group.fields.map(f => {
        const name = isZh ? f.nameZh : f.name;
        return f.unit ? `${name}(${f.unit})` : name;
      });
      csv += headers.map(h => `"${h}"`).join(',') + '\n';

      for (const rec of groupRecords) {
        const cells = [];
        for (const v of rec.values) {
          if (v.bitTag && v.bitLabels) {
            cells.push(`"${v.bitLabels.join(' ')}"`);
          } else {
            cells.push(`"${v.displayValue}"`);
          }
        }
        csv += cells.join(',') + '\n';
      }
      csv += '\n';
    }

    const content = BOM + csv;
    const filename = `bms-fault-records-${Date.now()}.csv`;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'bms:download-file',
        payload: { filename, content, mimeType: 'text/csv;charset=utf-8' },
      }, '*');
    } else {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [calendarGroups, nonEmptyRecords, isZh]);

  if (calendarGroups.length === 0) {
    return <div className={styles.empty}>{t('fault.emptyState')}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={readCalendar}>
          {t('fault.readRecords')}
        </button>
        <button
          className={styles.btn}
          onClick={handleExport}
          disabled={nonEmptyRecords.length === 0}
        >
          {t('fault.exportRecords')}
        </button>
      </div>
      {nonEmptyRecords.length === 0 ? (
        <div className={styles.empty}>{t('fault.emptyState')}</div>
      ) : (
        calendarGroups.map((group, gIdx) => {
          const groupRecords = nonEmptyRecords.filter(r => r.groupIdx === gIdx);
          if (groupRecords.length === 0) return null;
          const groupName = isZh ? group.configNameZh : group.configNameEn;
          const freezeIdx = group.fields.findIndex(f => f.dataType === 'Time');
          return (
            <div key={gIdx} className={styles.group}>
              <div className={styles.groupHeader}>{groupName}</div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {group.fields.map((f, fi) => {
                        const isSticky = freezeIdx >= 0 && fi <= freezeIdx;
                        let left = 0;
                        if (isSticky && fi > 0) {
                          for (let k = 0; k < fi; k++) {
                            left += group.fields[k]!.dataType === 'Time' ? 100 : 80;
                          }
                        }
                        return (
                          <th
                            key={fi}
                            className={`${styles.th} ${isSticky ? styles.thSticky : ''}`}
                            style={isSticky ? { left } : undefined}
                          >
                            {isZh ? f.nameZh : f.name}{f.unit ? `(${f.unit})` : ''}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupRecords.map((rec) => (
                      <FaultRow key={`${gIdx}-${rec.recordIdx}`} record={rec} freezeIdx={freezeIdx} fields={group.fields} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function FaultRow({ record, freezeIdx, fields }: { record: CalendarRecord; freezeIdx: number; fields: { dataType: string }[] }) {
  return (
    <tr className={styles.tr}>
      {record.values.map((v, vi) => {
        const isSticky = freezeIdx >= 0 && vi <= freezeIdx;
        const isTime = v.dataType === 'Time';
        let left = 0;
        if (isSticky && vi > 0) {
          for (let k = 0; k < vi; k++) {
            left += fields[k]!.dataType === 'Time' ? 100 : 80;
          }
        }
        return (
          <td
            key={vi}
            className={`${styles.td} ${isSticky ? styles.tdSticky : ''} ${isTime ? styles.tdTime : ''}`}
            style={isSticky ? { left } : undefined}
          >
            {v.bitTag && v.bitLabels ? (
              <div className={styles.bitWrap}>
                {v.bitLabels.map((bl) => (
                  <span key={bl} className={styles.bitTag}>{bl}</span>
                ))}
              </div>
            ) : (
              <span>{v.displayValue}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
