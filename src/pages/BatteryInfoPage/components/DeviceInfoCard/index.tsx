/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { DeviceInfoField } from '@/types';

interface DeviceInfoCardProps {
  bmsId?: string;
  extraFields: DeviceInfoField[];
  noShell?: boolean;
}

export function DeviceInfoCard({ extraFields }: DeviceInfoCardProps) {
  return (
    <div className="infoBody">
      {extraFields.length > 0 ? extraFields.map((field, i) => (
        <div key={i} className="infoItem">
          <span className="infoLabel">{field.label}</span>
          <span>
            <span className="infoVal">{field.value}</span>
            {field.unit && <span style={{ color: 'var(--color-muted-foreground)', marginLeft: 2 }}>{field.unit}</span>}
          </span>
        </div>
      )) : (
        <div style={{ color: 'var(--color-muted-foreground)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>--</div>
      )}
    </div>
  );
}
