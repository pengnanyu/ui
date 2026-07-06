/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export interface ParamOption {
  label: string;
  value: string | number;
}

export interface ParamItem {
  key: string;
  label: string;
  value: string | number;
  displayValue?: string;
  unit?: string;
  group: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  readonly?: boolean;
  description?: string;
  dataType?: string;
  byteLen?: number;
  pendingImportValue?: number;
}