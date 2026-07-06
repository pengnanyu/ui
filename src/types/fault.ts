/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export interface FaultRecord {
  id: string;
  code: string;
  message: string;
  level: 'warning' | 'error' | 'critical';
  startTime: number;
  endTime: number | null;
  active: boolean;
}