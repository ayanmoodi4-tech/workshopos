import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  JobPriority,
  JobStatus,
  TimerState,
  WorkerStatus,
} from "../../backend";
import type {
  Assignment,
  Job,
  TimerRecordView,
  Worker,
} from "../../backend.d.ts";
import { PriorityBadge, StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function formatElapsed(seconds: bigint): string {
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

function getLiveElapsed(timer: TimerRecordView): bigint {
  if (timer.state !== TimerState.running) return timer.elapsedSeconds;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const startSec = timer.startedAt / 1_000_000_000n;
  const paused = timer.totalPausedNanos / 1_000_000_000n;
  const live = nowSec - startSec - paused;
  return live > 0n ? live : 0n;
}

function useLiveTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return tick;
}

const statusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Pending Assignment", value: JobStatus.pendingAssignment },
  { label: "In Progress", value: JobStatus.inProgress },
  { label: "Paused", value: JobStatus.paused },
  { label: "Completed", value: JobStatus.completed },
  { label: "Cancelled", value: JobStatus.cancelled },
] as const;

const priorityOptions = [
  { label: "All Priorities", value: "all" },
  { label: "High", value: JobPriority.high },
  { label: "Medium", value: JobPriority.medium },
  { label: "Low", value: JobPriority.low },
] as const;

// ── Elapsed Cell (live for in-progress) ────────────────────────────────────

function ElapsedCell({
  job,
  timerMap,
}: {
  job: Job;
  timerMap: Map<string, TimerRecordView>;
}) {
  const timer = timerMap.get(job.jobId);
  if (!timer) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const elapsed = getLiveElapsed(timer);
  const isRunning = timer.state === TimerState.running;
  return (
    <span
      className={`text-xs font-mono tabular-nums font-medium ${isRunning ? "text-blue-700" : "text-foreground"}`}
    >
      {formatElapsed(elapsed)}
      {isRunning && (
        <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse align-middle" />
      )}
    </span>
  );
}

// ── Worker Name Cell ────────────────────────────────────────────────────────

function WorkerCell({
  jobId,
  assignmentMap,
  workerMap,
}: {
  jobId: string;
  assignmentMap: Map<string, Assignment>;
  workerMap: Map<bigint, Worker>;
}) {
  const assignment = assignmentMap.get(jobId);
  if (!assignment) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }
  const worker = workerMap.get(assignment.primaryWorkerId);
  return (
    <span className="text-xs text-foreground truncate max-w-[120px]">
      {worker ? worker.name : String(assignment.primaryWorkerId)}
      {assignment.assistWorkerIds.length > 0 && (
        <span className="ml-1 text-muted-foreground">
          +{assignment.assistWorkerIds.length}
        </span>
      )}
    </span>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function JobBoard() {
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const navigate = useNavigate();
  useLiveTick();

  const enabled = !!actor && !isFetching;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const { data: allJobs = [], isLoading } = useQuery({
    queryKey: ["jobboard.allJobs"],
    queryFn: () => actor!.listAllJobs(),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: workers = [] } = useQuery({
    queryKey: ["jobboard.workers"],
    queryFn: () => actor!.listWorkers(WorkerStatus.active),
    enabled,
  });

  // Fetch assignments for all jobs
  const { data: assignmentsRaw = [] } = useQuery({
    queryKey: ["jobboard.assignments", allJobs.map((j) => j.jobId).join(",")],
    queryFn: async () => {
      if (!actor || allJobs.length === 0) return [];
      const results = await Promise.all(
        allJobs.map((j) => actor.getAssignment(j.jobId)),
      );
      return results.filter((r): r is Assignment => r !== null);
    },
    enabled: enabled && allJobs.length > 0,
  });

  // Fetch timers for in-progress jobs
  const inProgressIds = allJobs
    .filter(
      (j) => j.status === JobStatus.inProgress || j.status === JobStatus.paused,
    )
    .map((j) => j.jobId);

  const { data: timersRaw = [] } = useQuery({
    queryKey: ["jobboard.timers", inProgressIds.join(",")],
    queryFn: async () => {
      if (!actor || inProgressIds.length === 0) return [];
      const results = await Promise.all(
        inProgressIds.map((id) => actor.getJobTimerState(id)),
      );
      return results.filter((r): r is TimerRecordView => r !== null);
    },
    enabled: enabled && inProgressIds.length > 0,
    refetchInterval: 10_000,
  });

  const { data: overdueMap = new Map<string, boolean>() } = useQuery({
    queryKey: ["jobboard.overdue", allJobs.map((j) => j.jobId).join(",")],
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

  const timerMap = useMemo(
    () => new Map<string, TimerRecordView>(timersRaw.map((t) => [t.jobId, t])),
    [timersRaw],
  );

  const assignmentMap = useMemo(
    () => new Map<string, Assignment>(assignmentsRaw.map((a) => [a.jobId, a])),
    [assignmentsRaw],
  );

  const workerMap = useMemo(
    () => new Map<bigint, Worker>(workers.map((w) => [w.id, w])),
    [workers],
  );

  // Filtering
  const filtered = useMemo(() => {
    return allJobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (priorityFilter !== "all" && j.priority !== priorityFilter)
        return false;
      if (fromDate) {
        const jobDate = new Date(Number(j.createdAt / 1_000_000n));
        if (jobDate < new Date(fromDate)) return false;
      }
      if (toDate) {
        const jobDate = new Date(Number(j.createdAt / 1_000_000n));
        if (jobDate > new Date(`${toDate}T23:59:59`)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const assignment = assignmentMap.get(j.jobId);
        const worker = assignment
          ? workerMap.get(assignment.primaryWorkerId)
          : undefined;
        return (
          j.jobId.toLowerCase().includes(q) ||
          j.customerName.toLowerCase().includes(q) ||
          j.carMake.toLowerCase().includes(q) ||
          j.carModel.toLowerCase().includes(q) ||
          j.carPlate.toLowerCase().includes(q) ||
          (worker?.name.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [
    allJobs,
    statusFilter,
    priorityFilter,
    fromDate,
    toDate,
    search,
    assignmentMap,
    workerMap,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  function jobHref(jobId: string): never {
    if (role === "Admin") return `/admin/jobs/${jobId}` as never;
    if (role === "WorkshopManager") return `/workshop/jobs/${jobId}` as never;
    return `/sales/jobs/${jobId}` as never;
  }

  return (
    <div data-ocid="job_board.page" className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Job Board
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All workshop jobs — {allJobs.length} total
          </p>
        </div>
        {role === "SalesManager" && (
          <Button
            data-ocid="job_board.create_job_button"
            className="shrink-0"
            onClick={() => navigate({ to: "/sales/jobs/new" as never })}
          >
            <Plus size={16} className="mr-1.5" />
            New Job
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            data-ocid="job_board.search_input"
            placeholder="Search by Job ID, customer, car plate, worker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Dropdowns + date range */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              data-ocid="job_board.status_select"
              className="h-9 w-44 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger
              data-ocid="job_board.priority_select"
              className="h-9 w-40 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <label
              htmlFor="from-date"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              From
            </label>
            <Input
              id="from-date"
              data-ocid="job_board.from_date_input"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="to-date"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              To
            </label>
            <Input
              id="to-date"
              data-ocid="job_board.to_date_input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>

          {(search !== "" ||
            statusFilter !== "all" ||
            priorityFilter !== "all" ||
            fromDate !== "" ||
            toDate !== "") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground"
              data-ocid="job_board.clear_filters_button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setPriorityFilter("all");
                setFromDate("");
                setToDate("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            data-ocid="job_board.empty_state"
            className="text-center py-16 text-muted-foreground"
          >
            <Briefcase size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium text-foreground">No jobs found</p>
            <p className="text-xs mt-1">
              {search ||
              statusFilter !== "all" ||
              priorityFilter !== "all" ||
              fromDate ||
              toDate
                ? "Try adjusting your filters"
                : "No jobs have been created yet"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 border-b border-border">
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 pl-4 whitespace-nowrap">
                    Job ID
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 whitespace-nowrap">
                    Customer
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 whitespace-nowrap">
                    Car
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 whitespace-nowrap">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 whitespace-nowrap">
                    Assigned To
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 text-right whitespace-nowrap">
                    Est. Time
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 text-right whitespace-nowrap">
                    Elapsed
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground py-3 text-right pr-4 whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((job, i) => {
                  const isOverdue = overdueMap.get(job.jobId) ?? false;
                  const rowBg = isOverdue
                    ? "bg-red-50 hover:bg-red-100"
                    : "hover:bg-muted/30";
                  const globalIndex = (safePage - 1) * PAGE_SIZE + i + 1;

                  return (
                    <TableRow
                      key={job.jobId}
                      data-ocid={`job_board.item.${globalIndex}`}
                      className={`cursor-pointer border-b border-border/60 transition-colors ${rowBg}`}
                      onClick={() => navigate({ to: jobHref(job.jobId) })}
                    >
                      <TableCell className="py-3 pl-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-medium text-foreground">
                            {job.jobId}
                          </span>
                          {isOverdue && (
                            <AlertCircle
                              size={12}
                              className="text-red-600 shrink-0"
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="min-w-0 max-w-[140px]">
                          <p className="text-xs font-medium text-foreground truncate">
                            {job.customerName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {job.customerPhone}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="min-w-0 max-w-[130px]">
                          <p className="text-xs font-medium text-foreground truncate">
                            {job.carMake} {job.carModel}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {job.carPlate}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge
                            status={isOverdue ? "overdue" : job.status}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <PriorityBadge priority={job.priority} />
                      </TableCell>
                      <TableCell className="py-3">
                        <WorkerCell
                          jobId={job.jobId}
                          assignmentMap={assignmentMap}
                          workerMap={workerMap}
                        />
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {Number(job.estimatedHours)}h
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <ElapsedCell job={job} timerMap={timerMap} />
                      </TableCell>
                      <TableCell className="py-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {role === "WorkshopManager" &&
                            job.status === JobStatus.pendingAssignment && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2 whitespace-nowrap"
                                data-ocid={`job_board.assign_button.${globalIndex}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate({ to: jobHref(job.jobId) });
                                }}
                              >
                                <UserPlus size={11} className="mr-1" />
                                Assign
                              </Button>
                            )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] px-2"
                            data-ocid={`job_board.view_button.${globalIndex}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({ to: jobHref(job.jobId) });
                            }}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} jobs
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                data-ocid="job_board.pagination_prev"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                  const pageNum =
                    totalPages <= 5
                      ? idx + 1
                      : safePage <= 3
                        ? idx + 1
                        : safePage >= totalPages - 2
                          ? totalPages - 4 + idx
                          : safePage - 2 + idx;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === safePage ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      data-ocid={`job_board.page_button.${pageNum}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                data-ocid="job_board.pagination_next"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Footer count when no pagination */}
        {!isLoading && filtered.length <= PAGE_SIZE && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {filtered.length} job{filtered.length !== 1 ? "s" : ""} shown
              {allJobs.length !== filtered.length &&
                ` (${allJobs.length} total)`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
