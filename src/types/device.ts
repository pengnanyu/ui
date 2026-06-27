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