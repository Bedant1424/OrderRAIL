import React from "react";
import { cn } from "@/lib/utils";

export interface DsColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
}

export interface DsTableProps<T> {
  columns: DsColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DsTable<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  className,
}: DsTableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-2xl border border-border/30 bg-card shadow-soft", className)}>
      <table className="w-full text-left text-xs font-sans">
        <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px] border-b border-border/20 sticky top-0 backdrop-blur-md">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="py-3 px-4">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20 font-medium">
          {data.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "transition hover:bg-muted/30",
                onRowClick && "cursor-pointer active:bg-muted/50"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4 text-foreground">
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
