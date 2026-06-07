import type { ReactNode } from "react";
import { X } from "lucide-react";
import Button from "./Button";

interface SlidePanelProps {
  open: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export default function SlidePanel({ open, title, description, children, onClose }: SlidePanelProps) {
  if (!open) return null;

  return (
    <>
      <button className="crm-slide-backdrop-v2" aria-label="패널 닫기" onClick={onClose} />
      <aside className="crm-slide-panel-v2">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--border)", background: "var(--glass)", backdropFilter: "blur(18px)" }}>
          <div className="min-w-0">
            {title && <h2 className="crm-section-title">{title}</h2>}
            {description && <p className="crm-subtitle mt-1">{description}</p>}
          </div>
          <Button type="button" variant="ghost" className="h-9 w-9 p-0" onClick={onClose} aria-label="닫기">
            <X size={16} />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </aside>
    </>
  );
}
