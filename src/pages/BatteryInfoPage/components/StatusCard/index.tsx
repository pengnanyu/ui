import type { StatusGroup as StatusGroupType } from '@/types';
import { CardShell } from '@/components/shared/CardShell';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatusGroup } from './StatusGroup';

interface StatusCardProps {
  statusGroups: StatusGroupType[];
  loading?: boolean;
}

export function StatusCard({ statusGroups, loading }: StatusCardProps) {
  if (loading) return <LoadingSkeleton variant="card" />;

  const sorted = [...statusGroups].sort((a, b) => {
    const order = { safety: 0, alarm: 1, status: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <CardShell title="状态指示">
      {sorted.map((group, i) => (
        <StatusGroup key={i} group={group} />
      ))}
    </CardShell>
  );
}