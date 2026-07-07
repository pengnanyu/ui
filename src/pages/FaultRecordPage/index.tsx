/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useCallback, useRef, useLayoutEffect, useState } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { CalendarRecord, CalendarGroup } from '@/utils/modbus';
import { isApp } from '@/utils/platform';
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
    // In Android app, use native bridge to save file
    if (isApp() && (window as unknown as Record<string, unknown>).__APP_BRIDGE__) {
      const bridge = (window as unknown as { __APP_BRIDGE__: { postMessage: (msg: unknown) => void } }).__APP_BRIDGE__;
      bridge.postMessage({
        type: 'bms:download-file',
        payload: { filename, content, mimeType: 'text/csv;charset=utf-8' },
      });
      return;
    }
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
    return (
      <div className={styles.container}>
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span>{t('fault.title')}</span>
            <div className={styles.groupActions}>
              <button className={styles.headerBtn} onClick={readCalendar}>{t('fault.readRecords')}</button>
              <button className={styles.headerBtn} disabled>{t('fault.exportRecords')}</button>
            </div>
          </div>
          <div className={styles.empty}>{t('fault.noFaults')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {calendarGroups.map((group, gIdx) => {
        const groupRecords = nonEmptyRecords.filter(r => r.groupIdx === gIdx);
        const groupName = isZh ? group.configNameZh : group.configNameEn;
        return (
          <FaultGroupCard
            key={gIdx}
            groupName={groupName}
            group={group}
            groupRecords={groupRecords}
            isZh={isZh}
            onRead={readCalendar}
            onExport={handleExport}
            canExport={nonEmptyRecords.length > 0}
            hasData={nonEmptyRecords.length > 0}
          />
        );
      })}
    </div>
  );
}

function FaultGroupCard({ groupName, group, groupRecords, isZh, onRead, onExport, canExport, hasData }: {
  groupName: string;
  group: CalendarGroup;
  groupRecords: CalendarRecord[];
  isZh: boolean;
  onRead: () => void;
  onExport: () => void;
  canExport: boolean;
  hasData: boolean;
}) {
  const { t } = useTranslation();
  const tableRef = useRef<HTMLTableElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const freezeIdx = group.fields.findIndex(f => f.dataType === 'Time');

  useLayoutEffect(() => {
    if (!tableRef.current) return;
    const ths = tableRef.current.querySelectorAll('thead th');
    const widths: number[] = [];
    ths.forEach(th => widths.push((th as HTMLElement).offsetWidth));
    setColWidths(widths);
  }, [group.fields, groupRecords]);

  const getLeft = (fi: number): number => {
    let left = 0;
    for (let k = 0; k < fi; k++) {
      left += colWidths[k] ?? 0;
    }
    return left;
  };

  return (
    <div className={styles.group}>
      <div className={styles.groupHeader}>
        <span>{groupName}</span>
        <div className={styles.groupActions}>
          <button className={styles.headerBtn} onClick={onRead}>{t('fault.readRecords')}</button>
          <button className={styles.headerBtn} onClick={onExport} disabled={!canExport}>{t('fault.exportRecords')}</button>
        </div>
      </div>
      {!hasData ? (
        <div className={styles.empty}>{t('fault.noFaults')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} ref={tableRef}>
            <thead>
              <tr>
                {group.fields.map((f, fi) => {
                  const isSticky = freezeIdx >= 0 && fi <= freezeIdx;
                  const isLastSticky = freezeIdx >= 0 && fi === freezeIdx;
                  return (
                    <th
                      key={fi}
                      className={`${styles.th} ${isSticky ? styles.thSticky : ''} ${isLastSticky ? styles.thStickyLast : ''}`}
                      style={isSticky ? { left: getLeft(fi) } : undefined}
                    >
                      {isZh ? f.nameZh : f.name}{f.unit ? `(${f.unit})` : ''}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groupRecords.map((rec, ri) => (
                <tr key={rec.recordIdx} className={`${styles.tr} ${ri % 2 === 1 ? styles.trEven : ''}`}>
                  {rec.values.map((v, vi) => {
                    const isSticky = freezeIdx >= 0 && vi <= freezeIdx;
                    const isLastSticky = freezeIdx >= 0 && vi === freezeIdx;
                    const isTime = v.dataType === 'Time';
                    return (
                      <td
                        key={vi}
                        className={`${styles.td} ${isSticky ? styles.tdSticky : ''} ${isLastSticky ? styles.tdStickyLast : ''} ${isTime ? styles.tdTime : ''}`}
                        style={isSticky ? { left: getLeft(vi) } : undefined}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
