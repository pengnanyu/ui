import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBmsStore } from '@/store/context';
import { ParamGroupCard } from './components/ParamGroupCard';
import { ParamToolbar } from './components/ParamToolbar';
import styles from './ParamConfigPage.module.css';

export function ParamConfigPage() {
  const { dataMemeryGroups } = useBmsStore();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';

  const handleValueChange = (_key: string, _newValue: string | number) => { };
  const handleBlur = (_key: string) => { };

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
        readonly: true,
      }));
      return { groupName, params };
    });
  }, [dataMemeryGroups, isZh]);

  return (
    <div>
      <ParamToolbar
        onReadParams={() => { }}
        onBatchWrite={() => { }}
        onImport={() => { }}
        onExport={() => { }}
        onPreset={(_id: string) => { }}
      />
      <div className={styles.masonry}>
        {paramGroups.map(({ groupName, params }) => (
          <ParamGroupCard
            key={groupName}
            groupName={groupName}
            params={params}
            onValueChange={handleValueChange}
            onBlur={handleBlur}
          />
        ))}
      </div>
    </div>
  );
}
