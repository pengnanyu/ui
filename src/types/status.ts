/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export type StatusGroupType = 'status' | 'alarm' | 'safety';

export interface StatusFlag {
  label: string;
  active: boolean;
}

export interface StatusGroup {
  name: string;
  type: StatusGroupType;
  flags: StatusFlag[];
}