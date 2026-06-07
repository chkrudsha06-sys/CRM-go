import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, description, kicker, actions }: PageHeaderProps) {
  return (
    <header className="crm-page-header">
      <div className="min-w-0">
        {kicker && <p className="crm-page-kicker">{kicker}</p>}
        <h1 className="crm-page-title">{title}</h1>
        {description && <p className="crm-page-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </header>
  );
}
