import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  emptyText?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyText = "표시할 데이터가 없습니다.",
  onRowClick,
  className = "",
}: DataTableProps<T>) {
  return (
    <div className={`crm-table-wrap-v2 ${className}`.trim()}>
      <table className="crm-table-v2 crm-force-center">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="flex min-h-[160px] items-center justify-center crm-row-sub">{emptyText}</div>
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={() => onRowClick?.(row, index)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row, index)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
