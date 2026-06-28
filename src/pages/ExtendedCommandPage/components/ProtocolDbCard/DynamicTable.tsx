import type { ProtocolDatabase } from '@/types';
import { buildRegisterAddr, calcRegLen, parseNum } from '@/utils/modbus';
import styles from './DynamicTable.module.css';

interface DynamicTableProps {
  database: ProtocolDatabase;
  onFillCommand: (hex: string) => void;
}

function isInstructionRow(row: Record<string, unknown>): boolean {
  return row['Code'] !== undefined && row['RegisterCode'] !== undefined && row['RegisterAddress'] !== undefined;
}

export function DynamicTable({ database, onFillCommand }: DynamicTableProps) {
  const { columns, rows } = database;

  const fixedCols = ['Type', 'Addr', 'RegLen', 'Value', 'Fill'];
  const dynamicCols = columns.filter(
    (c) => !fixedCols.includes(c) && !c.endsWith('_English') && !c.endsWith('_Chinase')
  );

  const allCols = [...dynamicCols, ...fixedCols];

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
          {rows.map((row, i) => {
            const isCmd = isInstructionRow(row);
            const isHidden = row['Show'] === 'FALSE';
            const rowClass = [
              isCmd ? styles.cmdRow : '',
              isHidden ? styles.rowHidden : '',
            ].filter(Boolean).join(' ');

            const registerCode = parseNum(row['RegisterCode'], 16);
            const registerAddress = parseNum(row['RegisterAddress'], 16);
            const addr = isCmd ? buildRegisterAddr(registerCode, registerAddress) : 0;
            const length = parseNum(row['Length'], 10);
            const regLen = calcRegLen(length, isCmd);

            return (
              <tr key={i} className={rowClass || undefined}>
                {allCols.map((col) => (
                  <td key={col}>
                    {col === 'Type' && (isCmd ? 'CMD' : 'DAT')}
                    {col === 'Addr' && (isCmd ? `0x${addr.toString(16).toUpperCase().padStart(4, '0')}` : '')}
                    {col === 'RegLen' && String(regLen)}
                    {col === 'Value' && (row['Value'] !== undefined ? String(row['Value']) : '')}
                    {col === 'Fill' && isCmd && (
                      <button className={styles.fillBtn} onClick={() => {
                        const slaveAddr = parseNum(row['Code'], 16);
                        const funcCode = registerCode & 0x3F;
                        const hex = [
                          slaveAddr,
                          funcCode,
                          (addr >> 8) & 0xFF,
                          addr & 0xFF,
                          (regLen >> 8) & 0xFF,
                          regLen & 0xFF,
                        ]
                          .map((v) => v.toString(16).toUpperCase().padStart(2, '0'))
                          .join(' ');
                        onFillCommand(hex);
                      }}>
                        Fill
                      </button>
                    )}
                    {!['Type', 'Addr', 'RegLen', 'Value', 'Fill'].includes(col) && String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}