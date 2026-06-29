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
  const { dataMemeryGroups, parsedValues, logs, writeField } = useBmsStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const isNarrow = useIsNarrow(NARROW_BREAKPOINT);

  const [activeGroupIdx, setActiveGroupIdx] = useState(0);
  const [mobileView, setMobileView] = useState<'nav' | 'detail'>('nav');

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
      }));
      return { groupName, params };
    });
  }, [dataMemeryGroups, isZh]);

  const recentLogs = useMemo(() => {
    const writeLogs = logs.filter(l => l.parsedInfo && (l.parsedInfo.startsWith('write') || l.parsedInfo.startsWith('1B write') || l.parsedInfo.startsWith('verify') || l.parsedInfo === 'write OK' || l.parsedInfo.includes('FAILED') || l.parsedInfo.includes('timeout') || l.parsedInfo.includes('CRC error')));
    return writeLogs.slice(-5);
  }, [logs]);

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
    <div
      className={styles.container}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <ParamToolbar
        onImport={() => { }}
        onExport={() => { }}
        onPreset={(_id: string) => { }}
      />
      {recentLogs.length > 0 && (
        <div className={styles.logBar}>
          {recentLogs.map(l => {
            const time = new Date(l.timestamp);
            const ts = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
            const isSuccess = l.parsedInfo === 'write OK';
            const isError = (l.parsedInfo ?? '').includes('FAILED') || (l.parsedInfo ?? '').includes('timeout') || (l.parsedInfo ?? '').includes('CRC error');
            const cls = isSuccess ? styles.logSuccess : isError ? styles.logError : styles.logInfo;
            return <span key={l.id} className={`${styles.logItem} ${cls}`}>{ts} {l.parsedInfo}</span>;
          })}
        </div>
      )}
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
  );
}
