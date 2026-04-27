import { cn } from "@/lib/utils";
import { JobStatus } from "../../backend";

interface StatusBadgeProps {
  status: JobStatus | "overdue";
  className?: string;
}

const statusConfig: Record<
  JobStatus | "overdue",
  { label: string; className: string }
> = {
  [JobStatus.pendingAssignment]: {
    label: "Pending",
    className: "bg-slate-100 text-slate-700 border border-slate-300",
  },
  [JobStatus.inProgress]: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 border border-blue-300",
  },
  [JobStatus.paused]: {
    label: "Paused",
    className: "bg-amber-100 text-amber-800 border border-amber-300",
  },
  [JobStatus.completed]: {
    label: "Completed",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  },
  [JobStatus.cancelled]: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border border-red-300",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-800 border border-red-300",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config =
    statusConfig[status] ?? statusConfig[JobStatus.pendingAssignment];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config = {
    high: {
      label: "High",
      className: "bg-red-100 text-red-700 border border-red-200",
    },
    medium: {
      label: "Medium",
      className: "bg-amber-100 text-amber-700 border border-amber-200",
    },
    low: {
      label: "Low",
      className: "bg-muted text-muted-foreground border border-border",
    },
  };
  const c = config[priority as keyof typeof config] ?? config.low;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}
