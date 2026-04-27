import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  PauseCircle,
  ScrollText,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  JobStatus,
  NotificationTrigger,
  RecipientRole,
  WorkerStatus,
} from "../../backend";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useBackendActor } from "../../lib/api";
import type { NotificationRecord } from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(timestampNanos: bigint): string {
  const ms = Number(timestampNanos / 1_000_000n);
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const triggerLabels: Partial<Record<NotificationTrigger, string>> = {
  [NotificationTrigger.job_created]: "Job Created",
  [NotificationTrigger.job_completed]: "Completed",
  [NotificationTrigger.overdue]: "Overdue",
  [NotificationTrigger.status_changed]: "Status Change",
  [NotificationTrigger.worker_idle]: "Worker Idle",
  [NotificationTrigger.attendance_anomaly]: "Attendance",
  [NotificationTrigger.incentive_awarded]: "Incentive",
};

const triggerColors: Partial<Record<NotificationTrigger, string>> = {
  [NotificationTrigger.overdue]: "bg-red-100 text-red-700 border-red-200",
  [NotificationTrigger.worker_idle]:
    "bg-amber-100 text-amber-700 border-amber-200",
  [NotificationTrigger.job_completed]:
    "bg-emerald-100 text-emerald-700 border-emerald-200",
  [NotificationTrigger.job_created]:
    "bg-blue-100 text-blue-700 border-blue-200",
  [NotificationTrigger.incentive_awarded]:
    "bg-purple-100 text-purple-700 border-purple-200",
  [NotificationTrigger.attendance_anomaly]:
    "bg-orange-100 text-orange-700 border-orange-200",
  [NotificationTrigger.status_changed]:
    "bg-slate-100 text-slate-700 border-slate-200",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  description?: string;
  loading?: boolean;
  accent?: "default" | "red" | "blue" | "green" | "amber";
  "data-ocid"?: string;
}

const accentStyles = {
  default: { icon: "bg-primary/10 text-primary", border: "border-border" },
  red: { icon: "bg-red-100 text-red-600", border: "border-red-200" },
  blue: { icon: "bg-blue-100 text-blue-600", border: "border-blue-200" },
  green: {
    icon: "bg-emerald-100 text-emerald-600",
    border: "border-emerald-200",
  },
  amber: { icon: "bg-amber-100 text-amber-700", border: "border-amber-200" },
};

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  accent = "default",
  "data-ocid": ocid,
}: StatCardProps) {
  const style = accentStyles[accent];
  return (
    <Card className={`bg-card border ${style.border}`} data-ocid={ocid}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <p className="text-3xl font-bold font-display text-foreground leading-none">
                {value}
              </p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground pt-0.5">
                {description}
              </p>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-xl ${style.icon} flex items-center justify-center shrink-0`}
          >
            <Icon size={18} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick Link Card ──────────────────────────────────────────────────────────

interface QuickLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  description: string;
  "data-ocid": string;
}

function QuickLink({
  to,
  icon: Icon,
  label,
  description,
  "data-ocid": ocid,
}: QuickLinkProps) {
  return (
    <Link
      to={to}
      data-ocid={ocid}
      className="group flex items-center gap-4 bg-card border border-border rounded-lg p-4 hover:border-ring hover:shadow-sm transition-smooth"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-smooth">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <ChevronRight
        size={16}
        className="text-muted-foreground group-hover:text-foreground transition-smooth shrink-0"
      />
    </Link>
  );
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  notif,
  index,
}: { notif: NotificationRecord; index: number }) {
  const triggerLabel = triggerLabels[notif.trigger] ?? notif.trigger;
  const colorClass =
    triggerColors[notif.trigger] ??
    "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div
      data-ocid={`admin_dashboard.notifications.item.${index}`}
      className="flex items-start gap-3 py-3 border-b border-border last:border-0"
    >
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Bell size={13} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug truncate">
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {notif.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimeAgo(notif.createdAt)}
        </p>
      </div>
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded border shrink-0 ${colorClass}`}
      >
        {triggerLabel}
      </span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { actor, isFetching } = useBackendActor();
  const enabled = !!actor && !isFetching;

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["admin.allJobs"],
    queryFn: () => actor!.listAllJobs(),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: allWorkers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["admin.workers.all"],
    queryFn: () => actor!.listWorkers(WorkerStatus.active),
    enabled,
    refetchInterval: 60_000,
  });

  const { data: notifications = [], isLoading: notifLoading } = useQuery({
    queryKey: ["admin.notifications"],
    queryFn: () => actor!.getMyNotifications(RecipientRole.admin),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: unreadCountRaw = 0n, isLoading: unreadLoading } = useQuery({
    queryKey: ["admin.unreadCount"],
    queryFn: () => actor!.getUnreadCount(RecipientRole.admin),
    enabled,
    refetchInterval: 30_000,
  });

  const unreadCount = Number(unreadCountRaw);

  // Compute job status counts
  const activeJobs = allJobs.filter(
    (j) => j.status !== JobStatus.completed && j.status !== JobStatus.cancelled,
  );
  const pendingJobs = allJobs.filter(
    (j) => j.status === JobStatus.pendingAssignment,
  );
  const inProgressJobs = allJobs.filter(
    (j) => j.status === JobStatus.inProgress,
  );
  const pausedJobs = allJobs.filter((j) => j.status === JobStatus.paused);
  const completedJobs = allJobs.filter((j) => j.status === JobStatus.completed);
  const cancelledJobs = allJobs.filter((j) => j.status === JobStatus.cancelled);

  // Overdue: inProgress jobs past their estimated time
  const now = Date.now();
  const overdueJobs = inProgressJobs.filter((j) => {
    const startEntry = j.statusHistory.find(
      (h) => h.status === JobStatus.inProgress,
    );
    if (!startEntry) return false;
    const startMs = Number(startEntry.timestamp / 1_000_000n);
    const estimatedMs = Number(j.estimatedHours) * 60 * 60 * 1000;
    return now - startMs > estimatedMs;
  });

  // Worker utilisation: active workers who are assigned to in-progress jobs
  // We approximate: active workers vs total active workers
  const assignedWorkerCount = inProgressJobs.length; // rough proxy — 1 primary each
  const workerUtilPct =
    allWorkers.length > 0
      ? Math.round(
          (Math.min(assignedWorkerCount, allWorkers.length) /
            allWorkers.length) *
            100,
        )
      : 0;

  // Recent 5 notifications sorted newest first
  const recentNotifs = [...notifications]
    .sort((a, b) => Number(b.createdAt - a.createdAt))
    .slice(0, 5);

  const isLoading = jobsLoading || workersLoading;

  return (
    <div data-ocid="admin_dashboard.page" className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Workshop overview — live metrics and recent activity
          </p>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border">
          {new Date().toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Overdue alert banner */}
      {!jobsLoading && overdueJobs.length > 0 && (
        <div
          data-ocid="admin_dashboard.overdue_banner"
          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {overdueJobs.length} job{overdueJobs.length !== 1 ? "s" : ""}{" "}
              overdue
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              These jobs have exceeded their estimated completion time and need
              attention.
            </p>
          </div>
          <Badge className="bg-red-600 text-white border-0 shrink-0">
            {overdueJobs.length}
          </Badge>
        </div>
      )}

      {/* Pending assignment alert */}
      {!jobsLoading && pendingJobs.length > 0 && (
        <div
          data-ocid="admin_dashboard.pending_banner"
          className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4"
        >
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {pendingJobs.length} job{pendingJobs.length !== 1 ? "s" : ""}{" "}
              pending assignment
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Assign workers to get these jobs started.
            </p>
          </div>
        </div>
      )}

      {/* Primary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          data-ocid="admin_dashboard.stat.active_jobs"
          title="Active Jobs"
          value={activeJobs.length}
          icon={Briefcase}
          accent="blue"
          loading={jobsLoading}
          description={`${pendingJobs.length} pending · ${inProgressJobs.length} running`}
        />
        <StatCard
          data-ocid="admin_dashboard.stat.overdue"
          title="Overdue Jobs"
          value={overdueJobs.length}
          icon={AlertTriangle}
          accent={overdueJobs.length > 0 ? "red" : "default"}
          loading={jobsLoading}
          description="Exceeded estimated time"
        />
        <StatCard
          data-ocid="admin_dashboard.stat.active_workers"
          title="Active Workers"
          value={allWorkers.length}
          icon={Users}
          accent="green"
          loading={workersLoading}
          description={`${workerUtilPct}% utilisation`}
        />
        <StatCard
          data-ocid="admin_dashboard.stat.notifications"
          title="Today's Alerts"
          value={unreadLoading ? "–" : unreadCount}
          icon={Bell}
          accent={unreadCount > 0 ? "amber" : "default"}
          loading={unreadLoading}
          description="Unread notifications"
        />
      </div>

      {/* Main content: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Status breakdown + Worker utilisation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status breakdown */}
          <Card className="bg-card border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                Job Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    status: JobStatus.pendingAssignment,
                    count: pendingJobs.length,
                    icon: ClipboardList,
                  },
                  {
                    status: JobStatus.inProgress,
                    count: inProgressJobs.length,
                    icon: Clock,
                  },
                  {
                    status: JobStatus.paused,
                    count: pausedJobs.length,
                    icon: PauseCircle,
                  },
                  {
                    status: JobStatus.completed,
                    count: completedJobs.length,
                    icon: CheckCircle2,
                  },
                  {
                    status: JobStatus.cancelled,
                    count: cancelledJobs.length,
                    icon: AlertCircle,
                  },
                ].map(({ status, count, icon: Icon }) => (
                  <div
                    key={status}
                    data-ocid={`admin_dashboard.status_pill.${status}`}
                    className="flex items-center justify-between bg-muted/40 border border-border rounded-lg px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={13} className="text-muted-foreground" />
                      <StatusBadge status={status} />
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-bold text-foreground">
                        {count}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Worker utilisation */}
          <Card className="bg-card border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <UserCheck size={16} className="text-primary" />
                Worker Utilisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    {workersLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      <p className="text-3xl font-bold font-display text-foreground">
                        {Math.min(assignedWorkerCount, allWorkers.length)}
                        <span className="text-lg text-muted-foreground font-medium">
                          &nbsp;/ {allWorkers.length}
                        </span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Workers on active jobs
                    </p>
                  </div>
                  <div className="text-right">
                    {workersLoading ? (
                      <Skeleton className="h-6 w-12" />
                    ) : (
                      <p className="text-2xl font-bold text-primary">
                        {workerUtilPct}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">utilised</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  {!workersLoading && (
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${workerUtilPct}%` }}
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="text-center p-2 bg-muted/40 rounded-lg border border-border">
                    {workersLoading ? (
                      <Skeleton className="h-5 w-6 mx-auto" />
                    ) : (
                      <p className="text-sm font-bold text-foreground">
                        {allWorkers.length}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Total Active
                    </p>
                  </div>
                  <div className="text-center p-2 bg-muted/40 rounded-lg border border-border">
                    {jobsLoading ? (
                      <Skeleton className="h-5 w-6 mx-auto" />
                    ) : (
                      <p className="text-sm font-bold text-foreground">
                        {inProgressJobs.length}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Jobs Running
                    </p>
                  </div>
                  <div className="text-center p-2 bg-muted/40 rounded-lg border border-border">
                    {workersLoading ? (
                      <Skeleton className="h-5 w-6 mx-auto" />
                    ) : (
                      <p className="text-sm font-bold text-foreground">
                        {Math.max(0, allWorkers.length - assignedWorkerCount)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick links */}
          <div>
            <h2 className="section-title">Quick Links</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <QuickLink
                to="/admin/jobs"
                icon={Briefcase}
                label="Job Board"
                description="View and manage all jobs"
                data-ocid="admin_dashboard.quicklink.job_board"
              />
              <QuickLink
                to="/admin/workers"
                icon={Users}
                label="All Workers"
                description="Worker profiles and history"
                data-ocid="admin_dashboard.quicklink.workers"
              />
              <QuickLink
                to="/admin/audit"
                icon={ScrollText}
                label="Audit Log"
                description="Full system activity trail"
                data-ocid="admin_dashboard.quicklink.audit"
              />
            </div>
          </div>
        </div>

        {/* Right: Recent notifications */}
        <div>
          <Card className="bg-card border border-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Bell size={16} className="text-primary" />
                  Recent Notifications
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge className="bg-red-500 text-white border-0 text-xs px-1.5 py-0.5 h-auto">
                    {unreadCount}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {notifLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                    >
                      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentNotifs.length === 0 ? (
                <div
                  data-ocid="admin_dashboard.notifications.empty_state"
                  className="text-center py-10"
                >
                  <Bell
                    size={28}
                    className="mx-auto text-muted-foreground mb-2"
                  />
                  <p className="text-sm font-medium text-foreground">
                    No notifications yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Alerts will appear here as activity happens
                  </p>
                </div>
              ) : (
                <>
                  <div data-ocid="admin_dashboard.notifications.list">
                    {recentNotifs.map((notif, i) => (
                      <NotificationRow
                        key={String(notif.id)}
                        notif={notif}
                        index={i + 1}
                      />
                    ))}
                  </div>
                  <div className="pt-3">
                    <Link to="/admin/notifications">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        data-ocid="admin_dashboard.notifications.view_all_button"
                      >
                        View all notifications
                        <ChevronRight size={13} className="ml-1" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
