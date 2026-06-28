import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBmsStore } from '@/store/context';
import { ParamToolbar } from './components/ParamToolbar';
import { ParamGroupCard } from './components/ParamGroupCard';
import styles from './ParamConfigPage.module.css';

export function ParamConfigPage() {
  const { dataMemeryGroups } = useBmsStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const [activeGroupIdx, setActiveGroupIdx] = useState(0);

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

  const handleValueChange = (_key: string, _newValue: string | number) => { };
  const handleBlur = (_key: string) => { };

  const currentGroup = paramGroups[activeGroupIdx] ?? null;

  return (
    <div className={styles.container}>
      <ParamToolbar
        onReadParams={() => { }}
        onBatchWrite={() => { }}
        onImport={() => { }}
        onExport={() => { }}
        onPreset={(_id: string) => { }}
      />
      <div className={styles.body}>
        <nav className={styles.nav}>
          {paramGroups.map((group, idx) => (
            <button
              key={group.groupName}
              className={`${styles.navItem} ${idx === activeGroupIdx ? styles.navItemActive : ''}`}
              onClick={() => setActiveGroupIdx(idx)}
            >
              {group.groupName}
            </button>
          ))}
        </nav>
        <div className={styles.content}>
          {currentGroup ? (
            <ParamGroupCard
              groupName={currentGroup.groupName}
              params={currentGroup.params}
              onValueChange={handleValueChange}
              onBlur={handleBlur}
              defaultExpanded
            />
          ) : (
            <div className={styles.empty}>暂无参数数据</div>
          )}
        </div>
      </div>
    </div>
  );
}
