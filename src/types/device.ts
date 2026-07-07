/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export interface DeviceInfoField {
  label: string;
  value: string;
  unit?: string;
}

export interface DeviceInfo {
  bmsId: string;
  bmsTime: string;
  extraFields: DeviceInfoField[];
}