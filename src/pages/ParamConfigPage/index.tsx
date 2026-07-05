import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBmsStore } from '@/store/context';

import { ParamGroupCard } from './components/ParamGroupCard';
import styles from './ParamConfigPage.module.css';

const NARROW_BREAKPOINT = 640;

function useIsNarrow(breakpoint: number): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return narrow;
}

export function ParamConfigPage() {
  const { dataMemeryGroups, parsedValues, deviceVersion, writeField, showToast, writeBatch, isBatchWriting } = useBmsStore();
  const { i18n, t } = useTranslation();
  const isZh = i18n.language === 'zh';
  const isNarrow = useIsNarrow(NARROW_BREAKPOINT);

  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [mobileView, setMobileView] = useState<'nav' | 'detail'>('nav');
  const [pendingImport, setPendingImport] = useState<Map<number, number>>(new Map());
  const prevBatchWritingRef = useRef(false);
  const parsedValuesByRow = useMemo(() => {
    const map = new Map<number, typeof parsedValues[number]>();
    for (const value of parsedValues) {
      map.set(value.rowIndex, value);
    }
    return map;
  }, [parsedValues]);

  const parsedValuesByNameAndAddr = useMemo(() => {
    const map = new Map<string, typeof parsedValues[number]>();
    for (const value of parsedValues) {
      map.set(`${value.name}::${value.absAddr}`, value);
    }
    return map;
  }, [parsedValues]);

  useEffect(() => {
    if (prevBatchWritingRef.current && !isBatchWriting && pendingImport.size > 0) {
      setPendingImport(new Map());
    }
    prevBatchWritingRef.current = isBatchWriting;
  }, [isBatchWriting, pendingImport.size]);

  const hasPendingImport = pendingImport.size > 0 || isBatchWriting;

  const paramGroups = useMemo(() => {
    return dataMemeryGroups.map(group => {
      const groupName = isZh ? group.configNameZh : group.configNameEn;
      const params = group.fields.map(field => ({
        key: `${field.rowIndex}`,
        label: isZh ? field.nameZh : field.name,
        value: field.value,
        displayValue: field.displayValue,
        unit: field.unit,
        group: groupName,
        dataType: field.dataType,
        byteLen: field.byteLen,
        readonly: ['r', 'ro'].includes(field.rwType.toLowerCase()),
        pendingImportValue: pendingImport.get(field.rowIndex),
      }));
      const hasPendingDiff = group.fields.some(f => pendingImport.has(f.rowIndex));
      return { groupName, params, hasPendingDiff };
    });
  }, [dataMemeryGroups, isZh, pendingImport]);

  const handleValueChange = useCallback((key: string, newValue: string | number) => {
    const rowIndex = parseInt(key, 10);
    if (isNaN(rowIndex)) return;
    const numVal = typeof newValue === 'string' ? Number(newValue) : newValue;
    if (isNaN(numVal)) return;
    const fv = parsedValuesByRow.get(rowIndex);
    if (fv && Math.abs(fv.value - numVal) < 1e-9) return;
    writeField(rowIndex, numVal);
  }, [parsedValuesByRow, writeField]);

  const handleBlur = useCallback((_key: string) => { }, []);

  const handleExport = useCallback(() => {
    const data = {
      version: deviceVersion ?? '',
      exportedAt: new Date().toISOString(),
      params: dataMemeryGroups.map(g => ({
        group: g.configNameEn,
        groupZh: g.configNameZh,
        fields: g.fields
          .filter(f => !['r', 'ro'].includes(f.rwType.toLowerCase()))
          .map(f => ({
            name: f.name,
            nameZh: f.nameZh,
            displayValue: f.displayValue,
            unit: f.unit,
            absAddr: '0x' + f.absAddr.toString(16).toUpperCase().padStart(4, '0'),
            byteLen: f.byteLen,
            byteOffset: f.byteOffset,
            operation: f.operation,
            ratio: f.ratio,
            dataType: f.dataType,
            rwType: f.rwType,
          })),
      })),
    };
    const json = JSON.stringify(data, null, 2);
    const defaultName = `bms-config-${deviceVersion ?? 'unknown'}.json`;

    const saveFile = async () => {
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          return;
        } catch (e: any) {
          if (e.name === 'AbortError') return;
        }
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'bms:download-file',
          payload: { filename: defaultName, content: json, mimeType: 'application/json' },
        }, '*');
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };
    saveFile();
  }, [dataMemeryGroups, deviceVersion]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (!data.version || !data.params) {
            showToast(isZh ? '无效的配置文件格式' : 'Invalid config file format', 'error');
            return;
          }
          if (data.version !== deviceVersion) {
            showToast(isZh ? `版本不匹配: 文件=${data.version}, 当前=${deviceVersion}` : `Version mismatch: file=${data.version}, current=${deviceVersion}`, 'error');
            return;
          }
          const pending = new Map<number, number>();
          for (const group of data.params) {
            for (const f of group.fields) {
              const importAddr = typeof f.absAddr === 'string' ? parseInt(f.absAddr, 16) : f.absAddr;
              const fv = parsedValuesByNameAndAddr.get(`${f.name}::${importAddr}`);
              if (fv && !['r', 'ro'].includes(fv.rwType.toLowerCase())) {
                const importDisplayVal = String(f.displayValue);
                if (fv.displayValue !== importDisplayVal) {
                  const numVal = fv.dataType === 'HEX' || fv.dataType === '2HEX'
                    ? parseInt(importDisplayVal, 16)
                    : parseFloat(importDisplayVal);
                  if (!isNaN(numVal)) {
                    pending.set(fv.rowIndex, numVal);
                  }
                }
              }
            }
          }
          setPendingImport(pending);
          if (pending.size === 0) {
            showToast(isZh ? '没有需要写入的差异参数' : 'No differences to write', 'error');
          }
        } catch {
          showToast(isZh ? '解析文件失败' : 'Failed to parse file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [deviceVersion, isZh, parsedValuesByNameAndAddr, showToast]);

  const handleConfirmImport = useCallback(() => {
    const fields: { fieldRowIndex: number; newValue: number }[] = [];
    pendingImport.forEach((value, rowIndex) => {
      fields.push({ fieldRowIndex: rowIndex, newValue: value });
    });

    writeBatch(fields);
  }, [pendingImport, writeBatch]);

  const handleCancelImport = useCallback(() => {
    setPendingImport(new Map());
  }, []);

  const currentGroup = paramGroups[activeGroupIdx] ?? null;

  const handleNavClick = useCallback((idx: number) => {
    setActiveGroupIdx(idx);
    setMobileView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setMobileView('nav');
  }, []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    touchStartRef.current = null;

    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    if (dx > 0 && mobileView === 'detail') {
      setMobileView('nav');
    } else if (dx < 0 && mobileView === 'nav' && paramGroups.length > 0) {
      setMobileView('detail');
    }
  }, [mobileView, paramGroups.length]);

  const showNav = !isNarrow || mobileView === 'nav';
  const showContent = !isNarrow || mobileView === 'detail';

  return (
    <>

      <div
        className={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.body}>
          {showNav && (
            <nav className={styles.nav}>
              <div className={styles.navToolbar}>
                {hasPendingImport ? (
                  <>
                    {!isBatchWriting && (
                      <button className={styles.navBtnCancel} onClick={handleCancelImport}>
                        {t('param.cancelImport')}
                      </button>
                    )}
                    <button className={styles.navBtnConfirm} onClick={handleConfirmImport} disabled={isBatchWriting}>
                      {isBatchWriting ? <span className={styles.spinner} /> : null}
                      {isBatchWriting ? t('param.writing') : t('param.confirmImport')}
                    </button>
                  </>
                ) : (
                  <>
                    <button className={styles.navBtn} onClick={handleImport}>{t('param.importConfig')}</button>
                    <button className={styles.navBtn} onClick={handleExport}>{t('param.exportConfig')}</button>
                    <button className={styles.navBtn} onClick={() => { }}>{t('param.preset')}</button>
                  </>
                )}
              </div>
              {paramGroups.map((group, idx) => (
                <button
                  key={group.groupName}
                  className={`${styles.navItem} ${idx === activeGroupIdx ? styles.navItemActive : ''} ${group.hasPendingDiff ? styles.navItemPending : ''}`}
                  onClick={() => handleNavClick(idx)}
                >
                  {group.groupName}
                  {group.hasPendingDiff && <span className={styles.navBadge} />}
                </button>
              ))}
            </nav>
          )}
          {showContent && (
            <div className={styles.content}>
              {currentGroup ? (
                <ParamGroupCard
                  groupName={currentGroup.groupName}
                  params={currentGroup.params}
                  onValueChange={handleValueChange}
                  onBlur={handleBlur}
                  onBack={isNarrow ? handleBack : undefined}
                />
              ) : (
                <div className={styles.empty}>{t('param.noParamData')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
