"use client";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-4xl mb-4 opacity-40">{icon}</div>
      <p className="text-sm font-bold mb-1" style={{ color: "var(--text-muted)" }}>{title}</p>
      {description && <p className="text-xs mb-4" style={{ color: "var(--text-subtle)" }}>{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
