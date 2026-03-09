import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  className?: string;
  valueColor?: "default" | "success" | "warning" | "danger";
  animate?: boolean;
}

export const MetricCard = ({
  icon,
  label,
  value,
  unit,
  subtext,
  className,
  valueColor = "default",
  animate = true,
}: MetricCardProps) => {
  const valueColorClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[valueColor];

  return (
    <div
      className={cn(
        "metric-card",
        animate && "animate-fade-in",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <div className="mt-1">
        <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
        <p className={cn("text-2xl font-bold mt-0.5 tracking-tight", valueColorClass)}>
          {value}
          {unit && <span className="text-sm font-medium text-muted-foreground ml-1">{unit}</span>}
        </p>
        {subtext && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  );
};
