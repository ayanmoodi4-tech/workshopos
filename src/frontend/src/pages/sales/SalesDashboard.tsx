import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  CheckCircle,
  ClipboardList,
  Package,
  PlusCircle,
  XCircle,
} from "lucide-react";
import { JobStatus } from "../../backend";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useBackendActor } from "../../lib/api";

function formatDate(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  colorClass,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  loading: boolean;
  colorClass: string;
}) {
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-14 mt-1" />
            ) : (
              <p className="text-3xl font-bold font-display text-foreground">
                {value}
              </p>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
          >
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboard() {
  const { actor, isFetching } = useBackendActor();

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["sales.allJobs"],
    queryFn: () => actor!.listAllJobs(),
    enabled: !!actor && !isFetching,
  });

  const thisMonth = new Date();
  const monthStart = new Date(
    thisMonth.getFullYear(),
    thisMonth.getMonth(),
    1,
  ).getTime();

  const monthJobs = allJobs.filter(
    (j) => Number(j.createdAt / 1_000_000n) >= monthStart,
  );

  const pending = allJobs.filter(
    (j) => j.status === JobStatus.pendingAssignment,
  );
  const inProgress = allJobs.filter((j) => j.status === JobStatus.inProgress);
  const completedMonth = monthJobs.filter(
    (j) => j.status === JobStatus.completed,
  );
  const cancelledMonth = monthJobs.filter(
    (j) => j.status === JobStatus.cancelled,
  );

  const recentJobs = [...allJobs]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, 5);

  return (
    <div data-ocid="sales_dashboard.page" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Sales Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Job pipeline overview for{" "}
            {thisMonth.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/sales/products">
              <Package size={15} className="mr-1.5" />
              Products
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            data-ocid="sales_dashboard.create_job_button"
          >
            <Link to="/sales/job-create">
              <PlusCircle size={15} className="mr-1.5" />
              New Job
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending"
          value={pending.length}
          icon={ClipboardList}
          loading={jobsLoading}
          colorClass="bg-slate-100 text-slate-600"
        />
        <StatCard
          title="In Progress"
          value={inProgress.length}
          icon={Briefcase}
          loading={jobsLoading}
          colorClass="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Completed (Month)"
          value={completedMonth.length}
          icon={CheckCircle}
          loading={jobsLoading}
          colorClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Cancelled (Month)"
          value={cancelledMonth.length}
          icon={XCircle}
          loading={jobsLoading}
          colorClass="bg-red-50 text-red-500"
        />
      </div>

      {/* Recent Jobs Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">Recent Job Cards</h2>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
          >
            <Link to="/sales/job-board">View all jobs →</Link>
          </Button>
        </div>

        <Card className="bg-card border border-border">
          {jobsLoading ? (
            <CardContent className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </CardContent>
          ) : recentJobs.length === 0 ? (
            <CardContent
              data-ocid="sales_dashboard.jobs.empty_state"
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <Briefcase
                size={36}
                className="text-muted-foreground mb-3 opacity-50"
              />
              <p className="text-sm font-semibold text-foreground">
                No jobs yet
              </p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Create your first job card to get started
              </p>
              <Button
                asChild
                size="sm"
                data-ocid="sales_dashboard.create_first_job_button"
              >
                <Link to="/sales/job-create">
                  <PlusCircle size={14} className="mr-1.5" />
                  Create Job
                </Link>
              </Button>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-semibold">
                      Job ID
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Customer
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Vehicle
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Created
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentJobs.map((job, i) => (
                    <TableRow
                      key={job.jobId}
                      data-ocid={`sales_dashboard.jobs.item.${i + 1}`}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <TableCell>
                        <Link
                          to={`/sales/jobs/${job.jobId}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {job.jobId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {job.customerName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.carMake} {job.carModel}{" "}
                        <span className="text-xs">({Number(job.carYear)})</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground text-right whitespace-nowrap">
                        {formatDate(job.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
