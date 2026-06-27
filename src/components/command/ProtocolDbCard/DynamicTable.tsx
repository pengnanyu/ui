import type { ProtocolDatabase } from '@/types';
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

            return (
              <tr key={i} className={rowClass || undefined}>
                {allCols.map((col) => (
                  <td key={col}>
                    {col === 'Type' && (isCmd ? 'CMD' : 'DAT')}
                    {col === 'Addr' && (isCmd ? String(row['RegisterAddress'] ?? '') : '')}
                    {col === 'RegLen' && String(row['Length'] ?? '')}
                    {col === 'Value' && (row['Value'] !== undefined ? String(row['Value']) : '')}
                    {col === 'Fill' && isCmd && (
                      <button className={styles.fillBtn} onClick={() => {
                        const hex = [row['Code'], row['RegisterCode'], row['RegisterAddress'], row['Length']]
                          .filter((v) => v !== undefined)
                          .map((v) => {
                            const n = typeof v === 'string' ? parseInt(v, 16) || 0 : 0;
                            return n.toString(16).toUpperCase().padStart(2, '0');
                          })
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