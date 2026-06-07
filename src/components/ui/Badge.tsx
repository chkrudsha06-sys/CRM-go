import type { ReactNode } from "react";

type BadgeTone = "default" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASS: Record<BadgeTone, string> = {
  default: "",
  accent: "crm-badge-accent-v2",
  success: "crm-badge-success-v2",
  warning: "crm-badge-warning-v2",
  danger: "crm-badge-danger-v2",
  info: "crm-badge-info-v2",
};

export default function Badge({ tone = "default", children, className = "" }: BadgeProps) {
  return <span className={`crm-badge-v2 ${TONE_CLASS[tone]} ${className}`.trim()}>{children}</span>;
}
