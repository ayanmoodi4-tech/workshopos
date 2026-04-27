import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Calendar, Car, Clock, User } from "lucide-react";
import type { Job } from "../../backend.d.ts";
import { PriorityBadge, StatusBadge } from "./StatusBadge";

interface JobCardProps {
  job: Job;
  href: string;
  className?: string;
  index?: number;
}

function formatDate(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function JobCard({ job, href, className, index }: JobCardProps) {
  return (
    <Link
      to={href}
      data-ocid={`job_card.item.${index ?? 1}`}
      className="block group"
    >
      <Card
        className={cn(
          "card-hover cursor-pointer border border-border bg-card group-hover:shadow-sm group-hover:border-ring transition-smooth",
          className,
        )}
      >
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground">
                {job.jobId}
              </p>
              <h3 className="font-semibold text-sm text-foreground truncate mt-0.5">
                {job.carMake} {job.carModel} ({Number(job.carYear)})
              </h3>
            </div>
            <StatusBadge status={job.status} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Car size={12} className="shrink-0" />
            <span className="truncate">{job.carPlate}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User size={12} className="shrink-0" />
            <span className="truncate">{job.customerName}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} className="shrink-0" />
            <span>{Number(job.estimatedHours)}h estimated</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={12} className="shrink-0" />
            <span>{formatDate(job.createdAt)}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <PriorityBadge priority={job.priority} />
            <span className="text-xs font-semibold text-foreground">
              AED {Number(job.projectPrice).toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
