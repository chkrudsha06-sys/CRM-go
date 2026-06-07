import type { ReactNode } from "react";

interface FilterBarProps {
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function FilterBar({ left, right, children, className = "" }: FilterBarProps) {
  return (
    <div className={`crm-toolbar-v2 mb-4 ${className}`.trim()}>
      {children ? (
        children
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{left}</div>
          <div className="flex flex-wrap items-center justify-end gap-2">{right}</div>
        </>
      )}
    </div>
  );
}
