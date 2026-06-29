import { useMemo, memo } from 'react';
import type { ProtocolDatabase } from '@/types';
import type { FieldValue } from '@/utils/modbus';
import { parseProtocolRows, isInstructionRow } from '@/utils/modbus';
import styles from './DynamicTable.module.css';

interface DynamicTableProps {
  database: ProtocolDatabase;
  parsedValues: FieldValue[];
  onFillCommand: (hex: string) => void;
}

interface RowProps {
  row: Record<string, unknown>;

  columns: string[];
  isCmd: boolean;
  isHidden: boolean;
  instInfo: { slaveAddr: number; funcCode: number; startAddr: number; quantity: number } | undefined;
  dataInfo: { absAddr: number; regLen: number } | undefined;
  valueDisplay: string;
  onFillCommand: (hex: string) => void;
}

const TableRow = memo(function TableRow({
  row, columns, isCmd, isHidden, instInfo, dataInfo, valueDisplay, onFillCommand,
}: Omit<RowProps, 'rowIndex'>) {
  const addr = isCmd && instInfo ? instInfo.startAddr : (dataInfo ? dataInfo.absAddr : 0);
  const regLen = isCmd && instInfo ? instInfo.quantity : (dataInfo ? dataInfo.regLen : 0);

  const rowClass = [
    isCmd ? styles.cmdRow : '',
    isHidden ? styles.rowHidden : '',
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowClass || undefined}>
      {columns.map((col) => {
        if (col === 'Kind') return <td key={col}>{isCmd ? 'CMD' : 'DAT'}</td>;
        if (col === 'Addr') return <td key={col}>{`0x${addr.toString(16).toUpperCase().padStart(4, '0')}`}</td>;
        if (col === 'RegLen') return <td key={col}>{String(regLen)}</td>;
        if (col === 'Value') return <td key={col}>{valueDisplay}</td>;
        if (col === 'Fill') {
          return <td key={col}>{isCmd && instInfo && (
            <button className={styles.fillBtn} onClick={() => {
              const hex = [
                instInfo.slaveAddr,
                instInfo.funcCode,
                (instInfo.startAddr >> 8) & 0xFF,
                instInfo.startAddr & 0xFF,
                (instInfo.quantity >> 8) & 0xFF,
                instInfo.quantity & 0xFF,
              ]
                .map((v) => v.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
              onFillCommand(hex);
            }}>
              Fill
            </button>
          )}</td>;
        }
        return <td key={col}>{String(row[col] ?? '')}</td>;
      })}
    </tr>
  );
});

export function DynamicTable({ database, parsedValues, onFillCommand }: DynamicTableProps) {
  const { columns, rows } = database;

  const parsed = useMemo(() => parseProtocolRows(rows), [rows]);

  const valueMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const fv of parsedValues) {
      map.set(fv.rowIndex, `${fv.displayValue}${fv.unit ? ' ' + fv.unit : ''}`);
    }
    return map;
  }, [parsedValues]);

  const dataFieldMap = useMemo(() => {
    const map = new Map<number, { absAddr: number; regLen: number }>();
    for (const df of parsed.dataFields) {
      map.set(df.rowIndex, { absAddr: df.absAddr, regLen: df.regLen });
    }
    return map;
  }, [parsed.dataFields]);

  const instructionMap = useMemo(() => {
    const map = new Map<number, { slaveAddr: number; funcCode: number; startAddr: number; quantity: number }>();
    for (const inst of parsed.instructions) {
      map.set(inst.rowIndex, { slaveAddr: inst.slaveAddr, funcCode: inst.funcCode, startAddr: inst.startAddr, quantity: inst.quantity });
    }
    return map;
  }, [parsed.instructions]);

  const fixedCols = ['Kind', 'Addr', 'RegLen', 'Value', 'Fill'];
  const allCols = useMemo(() => [...columns.filter(c => !fixedCols.includes(c)), ...fixedCols], [columns]);

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {allCols.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              row={row}

              columns={allCols}
              isCmd={isInstructionRow(row)}
              isHidden={row['Show'] === 'FALSE'}
              instInfo={instructionMap.get(i)}
              dataInfo={dataFieldMap.get(i)}
              valueDisplay={valueMap.get(i) ?? ''}
              onFillCommand={onFillCommand}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
