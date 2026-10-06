import React, { useState } from 'react';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  onRowDoubleClick?: (item: T) => void;
  className?: string;
  reorderable?: boolean;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  onRowClick,
  onRowDoubleClick,
  className = '',
  reorderable = false,
  onReorder,
}: DataTableProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!reorderable) return;
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!reorderable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!reorderable) return;
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex && onReorder) {
      onReorder(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className={`overflow-x-auto w-full ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={col.headerClassName || ''}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-[var(--text-dim)] font-mono text-xs">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => {
              const isDragging = draggedIndex === rowIdx;
              const isOver = dragOverIndex === rowIdx && draggedIndex !== rowIdx;

              let rowClass = 'transition-all ';
              if (reorderable) {
                rowClass += 'cursor-grab active:cursor-grabbing select-none ';
              } else if (onRowClick) {
                rowClass += 'cursor-pointer ';
              }

              if (isDragging) {
                rowClass += 'opacity-30 bg-[var(--surface-2)] ';
              } else if (isOver) {
                rowClass += 'border-t-2 border-[var(--brass)] bg-[var(--brass)]/10 ';
              }

              return (
                <tr
                  key={keyExtractor(item, rowIdx)}
                  draggable={reorderable}
                  onDragStart={(e) => handleDragStart(e, rowIdx)}
                  onDragOver={(e) => handleDragOver(e, rowIdx)}
                  onDrop={(e) => handleDrop(e, rowIdx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onRowClick && onRowClick(item)}
                  onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(item)}
                  className={rowClass}
                >
                  {columns.map((col, colIdx) => {
                    let content: React.ReactNode = null;
                    if (typeof col.accessor === 'function') {
                      content = col.accessor(item);
                    } else if (col.accessor) {
                      content = (item[col.accessor] as unknown) as React.ReactNode;
                    }
                    return (
                      <td key={colIdx} className={col.className || ''}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
