import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
  hover?: boolean;
}

export default function Card({ children, padded = true, hover = false, className = "", ...props }: CardProps) {
  return (
    <div className={`crm-card-v2 ${hover ? "premium-card-hover" : ""} ${padded ? "p-4 md:p-5" : ""} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
