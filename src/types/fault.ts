export interface FaultRecord {
  id: string;
  code: string;
  message: string;
  level: 'warning' | 'error' | 'critical';
  startTime: number;
  endTime: number | null;
  active: boolean;
}