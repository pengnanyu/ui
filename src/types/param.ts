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
}