import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "crm-btn-primary-v2",
  secondary: "crm-btn-secondary-v2",
  ghost: "crm-btn-ghost-v2",
};

export default function Button({
  variant = "secondary",
  icon,
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`crm-btn-v2 ${VARIANT_CLASS[variant]} ${fullWidth ? "w-full" : ""} ${className}`.trim()}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
