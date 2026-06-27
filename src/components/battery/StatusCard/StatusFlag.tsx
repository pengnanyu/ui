import type { StatusFlag as StatusFlagType, StatusGroupType } from '@/types';
import styles from './StatusFlag.module.css';

interface StatusFlagProps {
  flag: StatusFlagType;
  groupType: StatusGroupType;
}

export function StatusFlag({ flag, groupType }: StatusFlagProps) {
  const activeClass = flag.active ? styles[groupType] : styles[`${groupType}Inactive`];

  return (
    <span className={`${styles.flag} ${activeClass}`}>
      <span className={styles.dot} />
      {flag.label}
    </span>
  );
}