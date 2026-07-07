/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export interface SocData {
  soc: number;
  soh: number;
}

export interface PackData {
  totalVoltage: number;
  totalCurrent: number;
  power: number;
}

export interface CellVoltage {
  index: number;
  voltage: number;
  name?: string;
}

export interface TempData {
  index: number;
  temperature: number;
  name?: string;
}

export interface VoltageCurrentDataPoint {
  timestamp: number;
  voltage: number;
  current: number;
}