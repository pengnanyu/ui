import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBmsStore } from '@/store/context';
import { ParamToolbar } from './components/ParamToolbar';
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
  const { dataMemeryGroups, parsedValues, deviceVersion, toasts, writeField, showToast } = useBmsStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const isNarrow = useIsNarrow(NARROW_BREAKPOINT);

  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [mobileView, setMobileView] = useState<'nav' | 'detail'>('nav');
  const [pendingImport, setPendingImport] = useState<Map<number, number>>(new Map());

  const hasPendingImport = pendingImport.size > 0;

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
        readonly: field.rwType === 'R' || field.rwType === 'r' || field.rwType === 'RO',
        pendingImportValue: pendingImport.get(field.rowIndex),
      }));
      return { groupName, params };
    });
  }, [dataMemeryGroups, isZh, pendingImport]);

  const handleValueChange = useCallback((key: string, newValue: string | number) => {
    const rowIndex = parseInt(key, 10);
    if (isNaN(rowIndex)) return;
    const numVal = typeof newValue === 'string' ? Number(newValue) : newValue;
    if (isNaN(numVal)) return;
    const fv = parsedValues.find(v => v.rowIndex === rowIndex);
    if (fv && Math.abs(fv.value - numVal) < 1e-9) return;
    writeField(rowIndex, numVal);
  }, [writeField, parsedValues]);

  const handleBlur = useCallback((_key: string) => { }, []);

  const handleExport = useCallback(() => {
    const data = {
      version: deviceVersion ?? '',
      exportedAt: new Date().toISOString(),
      params: dataMemeryGroups.map(g => ({
        group: g.configNameEn,
        groupZh: g.configNameZh,
        fields: g.fields.map(f => ({
          name: f.name,
          nameZh: f.nameZh,
          value: f.value,
          displayValue: f.displayValue,
          unit: f.unit,
          absAddr: f.absAddr,
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
    const filename = `bms-config-${deviceVersion ?? 'unknown'}-${Date.now()}.json`;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'bms:download-file',
        payload: { filename, content: json, mimeType: 'application/json' },
      }, '*');
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
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
              const fv = parsedValues.find(v => v.name === f.name && v.absAddr === f.absAddr);
              if (fv && fv.rwType !== 'R' && fv.rwType !== 'r' && fv.rwType !== 'RO') {
                if (Math.abs(fv.value - f.value) >= 1e-9) {
                  pending.set(fv.rowIndex, f.value);
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
  }, [deviceVersion, isZh, parsedValues, showToast]);

  const handleConfirmImport = useCallback(() => {
    pendingImport.forEach((value, rowIndex) => {
      writeField(rowIndex, value);
    });
    setPendingImport(new Map());
  }, [pendingImport, writeField]);

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
      {toasts.length > 0 && (
        <div className={styles.toastBar}>
          {toasts.map(t => (
            <span key={t.id} className={`${styles.toastItem} ${t.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
              {t.message}
            </span>
          ))}
        </div>
      )}
      <div
        className={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ParamToolbar
          onImport={handleImport}
          onExport={handleExport}
          onPreset={(_id: string) => { }}
          hasPendingImport={hasPendingImport}
          onConfirmImport={handleConfirmImport}
          onCancelImport={handleCancelImport}
        />
        <div className={styles.body}>
          {showNav && (
            <nav className={styles.nav}>
              {paramGroups.map((group, idx) => (
                <button
                  key={group.groupName}
                  className={`${styles.navItem} ${idx === activeGroupIdx ? styles.navItemActive : ''}`}
                  onClick={() => handleNavClick(idx)}
                >
                  {group.groupName}
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
                <div className={styles.empty}>暂无参数数据</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
