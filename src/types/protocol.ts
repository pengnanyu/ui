/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export type ConfigRow = Record<string, unknown>;

export interface InstructionRow {
  rowIndex: number;
  funcCode: number;
  registerCode: number;
  registerAddress: number;
  startAddr: number;
  length: number;
  raw: ConfigRow;
}

export interface DataRow {
  rowIndex: number;
  derivedAddr: number;
  rawLength: number;
  regLength: number;
  parentInstructionIndex: number;
  regOffset: number;
  byteOffsetInReg: number;
  raw: ConfigRow;
}

export interface ParsedFieldValue {
  rowIndex: number;
  name: string;
  rawValue: number;
  value: number;
  displayValue: string;
  unit: string;
  raw: ConfigRow;
}

export interface ProtocolDatabase {
  version: string;
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  loadedAt: number;
}