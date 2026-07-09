/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import { useCallback, useRef, useLayoutEffect, useState, useMemo } from 'react';
import { useBmsStore } from '@/store/context';
import { useTranslation } from 'react-i18next';
import type { CalendarRecord, CalendarGroup, CalendarField } from '@/utils/modbus';
import { isApp } from '@/utils/platform';
import styles from './FaultRecordPage.module.css';

/** Format time display: split date and time, remove AM/PM and weekday */
function formatTimeDisplay(displayValue: string): { date: string; time: string } {
  // Original format: "YYYY-MM-DD HH:MM:SS AM W0"
  // or "YYYY-MM-DD HH:MM:SS PM W0"
  const match = displayValue.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (match) {
    return { date: match[1]!, time: match[2]! };
  }
  return { date: displayValue, time: '' };
}

/** Check if a field name is a MAX/MIN pair that should be merged.
 *  Supports both English (MAX/MIN Voltage/Temper) and Chinese (最高/最低 电压/温度) names. */
function getMergePair(name: string): 'voltage' | 'temper' | null {
  const lower = name.toLowerCase();
  const isMax = lower.includes('max') || name.includes('最高');
  const isMin = lower.includes('min') || name.includes('最低');
  if (!isMax && !isMin) return null;
  if (lower.includes('voltage') || name.includes('电压') || name.includes('压差')) return 'voltage';
  if (lower.includes('temper') || lower.includes('temp') || name.includes('温度') || name.includes('温差')) return 'temper';
  return null;
}

interface MergedColumn {
  type: 'single' | 'merged';
  fields: CalendarField[];
  label: string;
  labelZh: string;
  unit?: string;
}

/** Build merged column list from group fields */
function buildMergedColumns(group: CalendarGroup, isZh: boolean): MergedColumn[] {
  const columns: MergedColumn[] = [];
  const used = new Set<number>();

  for (let i = 0; i < group.fields.length; i++) {
    if (used.has(i)) continue;
    const field = group.fields[i]!;
    const pairType = getMergePair(isZh ? field.nameZh : field.name);

    if (pairType) {
      // Find the matching pair (MAX+MIN or MIN+MAX)
      let pairedIdx = -1;
      for (let j = i + 1; j < group.fields.length; j++) {
        if (used.has(j)) continue;
        const otherField = group.fields[j]!;
        const otherPair = getMergePair(isZh ? otherField.nameZh : otherField.name);
        if (otherPair === pairType) {
          pairedIdx = j;
          break;
        }
      }

      if (pairedIdx >= 0) {
        used.add(i);
        used.add(pairedIdx);
        const f1 = field;
        const f2 = group.fields[pairedIdx]!;
        // Determine label: use the common prefix (e.g., "MAX/MIN Voltage" -> "Voltage")
        const name1 = isZh ? f1.nameZh : f1.name;
        const name2 = isZh ? f2.nameZh : f2.name;
        const baseName = name1.replace(/^(MAX|MIN|最高|最低)\s*/i, '').trim() || name1;
        const baseNameZh = (isZh ? f1.nameZh : f1.name).replace(/^(最高|最低)\s*/, '').trim() || f1.nameZh;
        columns.push({
          type: 'merged',
          fields: [f1, f2],
          label: baseName,
          labelZh: baseNameZh,
          unit: f1.unit || f2.unit,
        });
        continue;
      }
    }

    // Single column
    used.add(i);
    columns.push({
      type: 'single',
      fields: [field],
      label: isZh ? field.nameZh : field.name,
      labelZh: field.nameZh,
      unit: field.unit,
    });
  }

  return columns;
}

/** Get display value for a record at a specific field index */
function getRecordValue(rec: CalendarRecord, fieldIdx: number): { displayValue: string; bitLabels?: string[]; bitTag: boolean; dataType: string } | null {
  if (fieldIdx >= rec.values.length) return null;
  const v = rec.values[fieldIdx]!;
  return { displayValue: v.displayValue, bitLabels: v.bitLabels, bitTag: v.bitTag, dataType: v.dataType };
}

export function FaultRecordPage() {
  const { calendarGroups, calendarRecords, readCalendar } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';

  const nonEmptyRecords = calendarRecords.filter(r => !r.isEmpty);

  const handleExport = useCallback(async () => {
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
    // In Android app, use native bridge to save file (shows system file save dialog)
    if (isApp() && (window as unknown as Record<string, unknown>).__APP_BRIDGE__) {
      const bridge = (window as unknown as { __APP_BRIDGE__: { postMessage: (msg: unknown) => void } }).__APP_BRIDGE__;
      bridge.postMessage({
        type: 'bms:download-file',
        payload: { filename, content, mimeType: 'text/csv;charset=utf-8' },
      });
      return;
    }
    // Use File System Access API for directory selection and filename editing
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
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

  // Build merged columns
  const mergedColumns = useMemo(() => buildMergedColumns(group, isZh), [group, isZh]);

  // Find the index of the Time field for sticky column
  const freezeIdx = useMemo(() => {
    let fieldIdx = -1;
    let colIdx = -1;
    for (let i = 0; i < group.fields.length; i++) {
      if (group.fields[i]!.dataType === 'Time') {
        fieldIdx = i;
        break;
      }
    }
    if (fieldIdx < 0) return -1;
    // Find which merged column contains this field
    for (let c = 0; c < mergedColumns.length; c++) {
      const col = mergedColumns[c]!;
      for (const f of col.fields) {
        const fIdx = group.fields.indexOf(f);
        if (fIdx === fieldIdx) return c;
      }
    }
    return -1;
  }, [group.fields, mergedColumns]);

  useLayoutEffect(() => {
    if (!tableRef.current) return;
    const ths = tableRef.current.querySelectorAll('thead th');
    const widths: number[] = [];
    ths.forEach(th => widths.push((th as HTMLElement).offsetWidth));
    setColWidths(widths);
  }, [mergedColumns, groupRecords]);

  const getLeft = (fi: number): number => {
    let left = 0;
    for (let k = 0; k < fi; k++) {
      left += colWidths[k] ?? 0;
    }
    return left;
  };

  // Map merged column to field indices in group.fields
  const columnFieldIndices = useMemo(() => {
    return mergedColumns.map(col => col.fields.map(f => group.fields.indexOf(f)));
  }, [mergedColumns, group.fields]);

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
                {mergedColumns.map((col, ci) => {
                  const isSticky = freezeIdx >= 0 && ci <= freezeIdx;
                  const isLastSticky = freezeIdx >= 0 && ci === freezeIdx;
                  const label = isZh ? col.labelZh : col.label;
                  return (
                    <th
                      key={ci}
                      className={`${styles.th} ${isSticky ? styles.thSticky : ''} ${isLastSticky ? styles.thStickyLast : ''}`}
                      style={isSticky ? { left: getLeft(ci) } : undefined}
                    >
                      <span className={styles.thName}>{label}</span>
                      {col.unit && <span className={styles.thUnit}>{col.unit}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groupRecords.map((rec, ri) => (
                <tr key={rec.recordIdx} className={`${styles.tr} ${ri % 2 === 1 ? styles.trEven : ''}`}>
                  {mergedColumns.map((col, ci) => {
                    const isSticky = freezeIdx >= 0 && ci <= freezeIdx;
                    const isLastSticky = freezeIdx >= 0 && ci === freezeIdx;
                    const fieldIndices = columnFieldIndices[ci]!;
                    const isTime = col.fields[0]!.dataType === 'Time';

                    return (
                      <td
                        key={ci}
                        className={`${styles.td} ${isSticky ? styles.tdSticky : ''} ${isLastSticky ? styles.tdStickyLast : ''} ${isTime ? styles.tdTime : ''}`}
                        style={isSticky ? { left: getLeft(ci) } : undefined}
                      >
                        {col.type === 'merged' ? (
                          <div className={styles.mergedCell}>
                            {fieldIndices.map((fIdx, mi) => {
                              const val = getRecordValue(rec, fIdx);
                              if (!val) return null;
                              const fieldName = isZh ? col.fields[mi]!.nameZh : col.fields[mi]!.name;
                              const isMax = fieldName.toLowerCase().includes('max') || fieldName.includes('最高');
                              if (val.bitTag && val.bitLabels) {
                                return (
                                  <div key={mi} className={styles.mergedRow}>
                                    <span className={styles.mergedLabel}>{isMax ? 'MAX' : 'MIN'}</span>
                                    <div className={styles.bitWrap}>
                                      {val.bitLabels.map((bl) => (
                                        <span key={bl} className={styles.bitTag}>{bl}</span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={mi} className={styles.mergedRow}>
                                  <span className={styles.mergedLabel}>{isMax ? 'MAX' : 'MIN'}</span>
                                  <span>{val.displayValue}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : isTime ? (
                          (() => {
                            const val = getRecordValue(rec, fieldIndices[0]!);
                            if (!val) return null;
                            const { date, time } = formatTimeDisplay(val.displayValue);
                            return (
                              <div className={styles.timeCell}>
                                <div>{date}</div>
                                <div>{time}</div>
                              </div>
                            );
                          })()
                        ) : (() => {
                          const val = getRecordValue(rec, fieldIndices[0]!);
                          if (!val) return null;
                          if (val.bitTag && val.bitLabels) {
                            return (
                              <div className={styles.bitWrap}>
                                {val.bitLabels.map((bl) => (
                                  <span key={bl} className={styles.bitTag}>{bl}</span>
                                ))}
                              </div>
                            );
                          }
                          return <span>{val.displayValue}</span>;
                        })()}
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
