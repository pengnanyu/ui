import { useState, useMemo } from 'react';
import type { ParamItem } from '@/types';
import { ParamGroupCard } from './components/ParamGroupCard';
import { ParamToolbar } from './components/ParamToolbar';
import styles from './ParamConfigPage.module.css';

export function ParamConfigPage() {
  const [params] = useState<ParamItem[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, ParamItem[]>();
    for (const p of params) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return map;
  }, [params]);

  const handleValueChange = (_key: string, _newValue: string | number) => { };
  const handleBlur = (_key: string) => { };

  return (
    <div>
      <ParamToolbar
        onReadParams={() => { }}
        onBatchWrite={() => { }}
        onImport={() => { }}
        onExport={() => { }}
        onPreset={() => { }}
      />
      <div className={styles.masonry}>
        {Array.from(grouped.entries()).map(([groupName, groupParams]) => (
          <ParamGroupCard
            key={groupName}
            groupName={groupName}
            params={groupParams}
            onValueChange={handleValueChange}
            onBlur={handleBlur}
          />
        ))}
      </div>
    </div>
  );
}