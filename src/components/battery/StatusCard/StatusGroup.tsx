import type { StatusGroup as StatusGroupType } from '@/types';
import { StatusFlag } from './StatusFlag';
import styles from './StatusGroup.module.css';

interface StatusGroupProps {
  group: StatusGroupType;
}

export function StatusGroup({ group }: StatusGroupProps) {
  const labelClass = {
    safety: styles.safetyLabel,
    alarm: styles.alarmLabel,
    status: styles.statusLabel,
  }[group.type];

  const visibleFlags = group.type === 'status'
    ? group.flags
    : group.flags.filter((f) => f.active);

  if (visibleFlags.length === 0 && group.type !== 'status') return null;

  return (
    <div className={styles.group}>
      <div className={`${styles.groupLabel} ${labelClass}`}>{group.name}</div>
      <div className={styles.flags}>
        {visibleFlags.map((flag, i) => (
          <StatusFlag key={i} flag={flag} groupType={group.type} />
        ))}
      </div>
    </div>
  );
}