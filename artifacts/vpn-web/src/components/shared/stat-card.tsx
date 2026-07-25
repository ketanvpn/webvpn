import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helperText?: string;
  href?: string;
  variant?: "default" | "primary" | "destructive";
}

export function StatCard({
  icon: Icon,
  label,
  value,
  helperText,
  href,
  variant = "default",
}: StatCardProps) {
  const variantClasses = {
    default:
      "border-white/10 bg-white/[0.04] hover:border-primary/50 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)]",
    primary:
      "border-primary/40 bg-primary/10 hover:shadow-[0_0_10px_rgba(16,185,129,0.25)]",
    destructive:
      "border-destructive/40 bg-destructive/10 hover:border-destructive hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  };

  const labelClasses = {
    default: "text-muted-foreground",
    primary: "text-primary",
    destructive: "text-destructive",
  };

  const valueClasses = {
    default: "text-foreground",
    primary: "text-primary",
    destructive: "text-destructive",
  };

  const iconClasses = {
    default: "text-muted-foreground",
    primary: "text-primary opacity-80",
    destructive: "text-destructive",
  };

  const content = (
    <div
      className={`rounded-xl border p-3 backdrop-blur-lg shadow-md cursor-pointer transition-all duration-300 ${variantClasses[variant]}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-medium ${labelClasses[variant]}`}>
          {label}
        </span>
        <Icon className={`h-3.5 w-3.5 ${iconClasses[variant]}`} />
      </div>
      <div className={`text-lg font-bold leading-tight ${valueClasses[variant]}`}>
        {value}
      </div>
      {helperText && (
        <div className="text-[10px] mt-0.5 text-muted-foreground">
          {helperText}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
