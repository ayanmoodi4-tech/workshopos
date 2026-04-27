import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, Clock, UserCheck, UserX, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { JobStatus, TimerState, WorkerStatus } from "../../backend";
import type { Job, TimerRecordView, Worker } from "../../backend.d.ts";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { useBackendActor } from "../../lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(seconds: bigint): string {
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function useLiveTick(intervalMs = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function getLiveElapsed(timer: TimerRecordView): bigint {
  if (timer.state !== TimerState.running) return timer.elapsedSeconds;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const startSec = timer.startedAt / 1_000_000_000n;
  const paused = timer.totalPausedNanos / 1_000_000_000n;
  const live = nowSec - startSec - paused;
  return live > 0n ? live : 0n;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`w-3 h-10 rounded-sm shrink-0 ${color}`} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-7 w-10 mt-1" />
          ) : (
            <p className="text-2xl font-bold font-display text-foreground">
              {value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface KanbanJobCardProps {
  job: Job;
  timerMap: Map<string, TimerRecordView>;
  isOverdueMap: Map<string, boolean>;
  onAssign?: (jobId: string) => void;
}

function KanbanJobCard({
  job,
  timerMap,
  isOverdueMap,
  onAssign,
}: KanbanJobCardProps) {
  const navigate = useNavigate();
  const timer = timerMap.get(job.jobId);
  const isOverdue = isOverdueMap.get(job.jobId) ?? false;
  const elapsed = timer ? getLiveElapsed(timer) : null;
  const cardBg = isOverdue
    ? "border-red-300 bg-red-50"
    : "border-border bg-card";

  function handleClick() {
    navigate({ to: `/workshop/jobs/${job.jobId}` as never });
  }

  return (
    <button
      type="button"
      data-ocid="kanban.job_card"
      className={`w-full text-left border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-smooth hover:border-ring ${cardBg}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] font-mono text-muted-foreground">
          {job.jobId}
        </p>
        {isOverdue && (
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-red-100 text-red-700 border border-red-300">
            Overdue
          </Badge>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground truncate mb-1">
        {job.carMake} {job.carModel}
      </p>
      <p className="text-xs text-muted-foreground truncate mb-2">
        {job.customerName} · {job.carPlate}
      </p>
      {elapsed !== null && (
        <div
          className={`flex items-center gap-1.5 text-xs font-mono font-medium mt-1 ${isOverdue ? "text-red-700" : "text-foreground"}`}
        >
          <Clock size={11} className="shrink-0" />
          <span>{formatElapsed(elapsed)}</span>
          <span className="text-muted-foreground font-sans">
            / {Number(job.estimatedHours)}h est.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
        <StatusBadge status={job.status} />
        {job.status === JobStatus.pendingAssignment && onAssign && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 shrink-0"
            data-ocid="kanban.assign_button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(job.jobId);
            }}
          >
            Assign
          </Button>
        )}
      </div>
    </button>
  );
}

interface KanbanColumnProps {
  title: string;
  jobs: Job[];
  timerMap: Map<string, TimerRecordView>;
  isOverdueMap: Map<string, boolean>;
  loading: boolean;
  accentClass: string;
  onAssign?: (jobId: string) => void;
  ocid: string;
}

function KanbanColumn({
  title,
  jobs,
  timerMap,
  isOverdueMap,
  loading,
  accentClass,
  onAssign,
  ocid,
}: KanbanColumnProps) {
  return (
    <div
      data-ocid={ocid}
      className="flex flex-col bg-muted/30 rounded-xl border border-border min-h-[400px]"
    >
      <div
        className={`flex items-center gap-2 px-4 py-3 border-b border-border ${accentClass} rounded-t-xl`}
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-xs font-bold bg-background border border-border text-foreground rounded-full px-2 py-0.5">
          {jobs.length}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto max-h-[500px]">
        {loading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)
        ) : jobs.length === 0 ? (
          <div
            data-ocid={`${ocid}.empty_state`}
            className="text-center py-8 text-muted-foreground"
          >
            <p className="text-xs">No jobs here</p>
          </div>
        ) : (
          jobs.map((job) => (
            <KanbanJobCard
              key={job.jobId}
              job={job}
              timerMap={timerMap}
              isOverdueMap={isOverdueMap}
              onAssign={onAssign}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Timer row in running timers panel ──────────────────────────────────────

interface TimerRowProps {
  job: Job;
  timer: TimerRecordView | undefined;
  isOverdue: boolean;
  onNavigate: (jobId: string) => void;
}

function TimerRow({ job, timer, isOverdue, onNavigate }: TimerRowProps) {
  const elapsed = timer ? getLiveElapsed(timer) : 0n;
  const estimatedSec = job.estimatedHours * 3600n;
  const progress =
    estimatedSec > 0n
      ? Math.min(100, Number((elapsed * 100n) / estimatedSec))
      : 0;
  const rowBg = isOverdue
    ? "border-red-300 bg-red-50"
    : "border-border bg-muted/30";
  const timerColor = isOverdue
    ? "text-red-700"
    : progress > 80
      ? "text-amber-600"
      : "text-foreground";
  const barColor = isOverdue
    ? "bg-red-500"
    : progress > 80
      ? "bg-amber-500"
      : "bg-blue-500";

  return (
    <button
      type="button"
      data-ocid="timer_overview.item"
      className={`w-full text-left rounded-lg border p-2.5 cursor-pointer hover:shadow-xs transition-smooth ${rowBg}`}
      onClick={() => onNavigate(job.jobId)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[100px]">
          {job.jobId}
        </p>
        <span
          className={`text-xs font-mono font-bold tabular-nums ${timerColor}`}
        >
          {formatElapsed(elapsed)}
        </span>
      </div>
      <p className="text-xs text-foreground truncate mb-1.5">
        {job.carMake} {job.carModel} · {job.customerName}
      </p>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function WorkshopDashboard() {
  const { actor, isFetching } = useBackendActor();
  const navigate = useNavigate();
  useLiveTick(); // triggers re-render every second for live timers

  const enabled = !!actor && !isFetching;

  const { data: allJobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["workshop.allJobs"],
    queryFn: () => actor!.listAllJobs(),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: workers = [], isLoading: workersLoading } = useQuery({
    queryKey: ["workshop.workers.active"],
    queryFn: () => actor!.listWorkers(WorkerStatus.active),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: allWorkers = [], isLoading: allWorkersLoading } = useQuery({
    queryKey: ["workshop.workers.all"],
    queryFn: () => actor!.listWorkers(null),
    enabled,
    refetchInterval: 30_000,
  });

  const inProgressJobs = allJobs.filter(
    (j) => j.status === JobStatus.inProgress,
  );
  const pendingJobs = allJobs.filter(
    (j) => j.status === JobStatus.pendingAssignment,
  );
  const pausedJobs = allJobs.filter((j) => j.status === JobStatus.paused);

  const { data: timersRaw = [] } = useQuery({
    queryKey: ["workshop.timers", inProgressJobs.map((j) => j.jobId).join(",")],
    queryFn: async () => {
      if (!actor || inProgressJobs.length === 0) return [];
      const results = await Promise.all(
        inProgressJobs.map((j) => actor.getJobTimerState(j.jobId)),
      );
      return results.filter((r): r is TimerRecordView => r !== null);
    },
    enabled: enabled && inProgressJobs.length > 0,
    refetchInterval: 10_000,
  });

  const { data: overdueMap = new Map<string, boolean>() } = useQuery({
    queryKey: ["workshop.overdue", allJobs.map((j) => j.jobId).join(",")],
    queryFn: async () => {
      if (!actor) return new Map<string, boolean>();
      const results = await Promise.all(
        allJobs.map(async (j) => {
          const r = await actor.isJobOverdue(j.jobId);
          return [j.jobId, r ?? false] as [string, boolean];
        }),
      );
      return new Map<string, boolean>(results);
    },
    enabled: enabled && allJobs.length > 0,
    refetchInterval: 60_000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayAttendance = [], isLoading: attendanceLoading } = useQuery(
    {
      queryKey: ["workshop.attendance.today", todayStr],
      queryFn: () =>
        actor!.queryAttendance({ fromDate: todayStr, toDate: todayStr }),
      enabled,
    },
  );

  const timerMap = new Map<string, TimerRecordView>(
    timersRaw.map((t) => [t.jobId, t]),
  );

  const activeWorkers: Worker[] = workers;
  const presentWorkers = todayAttendance.length;
  const lateWorkers = todayAttendance.filter((a) => a.isLate).length;
  const absentCount = (allWorkers as Worker[]).filter(
    (w) =>
      w.status === WorkerStatus.active &&
      !todayAttendance.some((a) => a.workerId === w.id),
  ).length;

  const overdueCount = Array.from(overdueMap.values()).filter(Boolean).length;

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div data-ocid="workshop_dashboard.page" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Workshop Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live floor status — {todayLabel}
          </p>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-800">
            {overdueCount} job{overdueCount !== 1 ? "s are" : " is"} overdue —
            immediate attention required
          </p>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          label="Pending Assignment"
          value={pendingJobs.length}
          color="bg-slate-400"
          loading={jobsLoading}
        />
        <SummaryTile
          label="In Progress"
          value={inProgressJobs.length}
          color="bg-blue-500"
          loading={jobsLoading}
        />
        <SummaryTile
          label="Paused"
          value={pausedJobs.length}
          color="bg-amber-400"
          loading={jobsLoading}
        />
        <SummaryTile
          label="Active Workers"
          value={activeWorkers.length}
          color="bg-emerald-500"
          loading={workersLoading}
        />
      </div>

      {/* 3-column Kanban */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          Job Board
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn
            ocid="kanban.pending"
            title="Pending Assignment"
            jobs={pendingJobs}
            timerMap={timerMap}
            isOverdueMap={overdueMap}
            loading={jobsLoading}
            accentClass="bg-slate-100"
            onAssign={(jobId) =>
              navigate({ to: `/workshop/jobs/${jobId}` as never })
            }
          />
          <KanbanColumn
            ocid="kanban.in_progress"
            title="In Progress"
            jobs={inProgressJobs}
            timerMap={timerMap}
            isOverdueMap={overdueMap}
            loading={jobsLoading}
            accentClass="bg-blue-50"
          />
          <KanbanColumn
            ocid="kanban.paused"
            title="Paused"
            jobs={pausedJobs}
            timerMap={timerMap}
            isOverdueMap={overdueMap}
            loading={jobsLoading}
            accentClass="bg-amber-50"
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Worker Availability */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users size={15} className="text-primary" />
              Worker Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex gap-3 text-center">
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                <p className="text-xl font-bold text-emerald-700">
                  {workersLoading ? "—" : activeWorkers.length}
                </p>
                <p className="text-[11px] text-emerald-600">Active</p>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2">
                <p className="text-xl font-bold text-slate-600">
                  {workersLoading
                    ? "—"
                    : Math.max(0, activeWorkers.length - inProgressJobs.length)}
                </p>
                <p className="text-[11px] text-slate-500">Available</p>
              </div>
            </div>
            <div
              data-ocid="worker_availability.list"
              className="space-y-1 max-h-40 overflow-y-auto"
            >
              {workersLoading || allWorkersLoading
                ? [1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-8 rounded" />
                  ))
                : activeWorkers.slice(0, 6).map((w) => (
                    <div
                      key={String(w.id)}
                      data-ocid="worker_availability.item"
                      className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/40 hover:bg-muted transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">
                          {w.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-foreground truncate">
                        {w.name}
                      </span>
                      <UserCheck
                        size={12}
                        className="ml-auto text-emerald-500 shrink-0"
                      />
                    </div>
                  ))}
              {activeWorkers.length > 6 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  +{activeWorkers.length - 6} more workers
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Running Timers */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock size={15} className="text-primary" />
              Running Timers
              <span className="ml-auto text-xs font-mono text-muted-foreground">
                live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5 max-h-52 overflow-y-auto">
            {jobsLoading ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))
            ) : inProgressJobs.length === 0 ? (
              <div
                data-ocid="timer_overview.empty_state"
                className="text-center py-6 text-muted-foreground"
              >
                <Clock size={24} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">No running timers</p>
              </div>
            ) : (
              inProgressJobs.map((job) => (
                <TimerRow
                  key={job.jobId}
                  job={job}
                  timer={timerMap.get(job.jobId)}
                  isOverdue={overdueMap.get(job.jobId) ?? false}
                  onNavigate={(jobId) =>
                    navigate({ to: `/workshop/jobs/${jobId}` as never })
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck size={15} className="text-primary" />
              {"Today's Attendance"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {attendanceLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">
                      Present
                    </span>
                  </div>
                  <span className="text-xl font-bold text-emerald-700">
                    {presentWorkers}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      Late
                    </span>
                  </div>
                  <span className="text-xl font-bold text-amber-700">
                    {lateWorkers}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center gap-2">
                    <UserX size={16} className="text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Absent
                    </span>
                  </div>
                  <span className="text-xl font-bold text-red-700">
                    {absentCount}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  Based on biometric check-ins for today
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
