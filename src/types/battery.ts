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