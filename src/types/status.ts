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