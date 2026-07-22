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
    <div className={cn("w-full overflow-x-auto rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md shadow-soft", className)}>
      <table className="w-full text-left text-xs font-sans">
        <thead className="bg-muted/40 text-muted-foreground font-extrabold uppercase tracking-widest text-[10px] border-b border-white/5 sticky top-0 backdrop-blur-md">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="py-3.5 px-4">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 font-medium">
          {data.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "transition duration-150 hover:bg-white/5",
                onRowClick && "cursor-pointer active:bg-white/10"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3.5 px-4 text-foreground/90 font-mono text-xs">
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
