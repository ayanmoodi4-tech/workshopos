import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  Car,
  ChevronLeft,
  Clock,
  DollarSign,
  History,
  Pause,
  Play,
  Settings2,
  Shield,
  Square,
  User,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AuditEntityType,
  JobStatus,
  TimerState,
  WorkerStatus,
} from "../../backend";
import { PriorityBadge, StatusBadge } from "../../components/ui/StatusBadge";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";
import type {
  AppSettings,
  Assignment,
  AuditEntry,
  Job,
  Product,
  TimerRecordView,
  Worker,
} from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: bigint) {
  return new Date(Number(ts / 1_000_000n)).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function workerName(workers: Worker[], id: bigint): string {
  return workers.find((w) => w.id === id)?.name ?? `#${id}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ─── Timer Section ────────────────────────────────────────────────────────────

function TimerSection({
  jobId,
  timerData,
  estimatedHours,
  settings,
  canControl,
  onRefresh,
}: {
  jobId: string;
  timerData: TimerRecordView | null;
  estimatedHours: bigint;
  settings: AppSettings | null;
  canControl: boolean;
  onRefresh: () => void;
}) {
  const { actor } = useBackendActor();
  const [localSeconds, setLocalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queryClient = useQueryClient();

  const timerState = timerData?.state ?? TimerState.stopped;
  const backendElapsed = Number(timerData?.elapsedSeconds ?? 0n);
  const estimatedSeconds = Number(estimatedHours) * 3600;
  const idleMinutes = Number(settings?.idleDetectionMinutes ?? 30n);

  // Sync local counter with backend on data change
  useEffect(() => {
    setLocalSeconds(backendElapsed);
  }, [backendElapsed]);

  // Local tick when timer is running
  useEffect(() => {
    if (timerState === TimerState.running) {
      intervalRef.current = setInterval(() => {
        setLocalSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState]);

  // Poll backend every 5 seconds when running
  useEffect(() => {
    if (timerState !== TimerState.running) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["timer", jobId] });
    }, 5000);
    return () => clearInterval(poll);
  }, [timerState, jobId, queryClient]);

  const startMut = useMutation({
    mutationFn: () => actor!.startJobTimer(jobId),
    onSuccess: () => {
      onRefresh();
      toast.success("Timer started");
    },
    onError: () => toast.error("Failed to start timer"),
  });
  const pauseMut = useMutation({
    mutationFn: () => actor!.pauseJobTimer(jobId),
    onSuccess: () => {
      onRefresh();
      toast.success("Timer paused");
    },
    onError: () => toast.error("Failed to pause timer"),
  });
  const resumeMut = useMutation({
    mutationFn: () => actor!.resumeJobTimer(jobId),
    onSuccess: () => {
      onRefresh();
      toast.success("Timer resumed");
    },
    onError: () => toast.error("Failed to resume timer"),
  });
  const stopMut = useMutation({
    mutationFn: () => actor!.stopJobTimer(jobId),
    onSuccess: () => {
      onRefresh();
      toast.success("Timer stopped");
    },
    onError: () => toast.error("Failed to stop timer"),
  });

  const isOverdue = estimatedSeconds > 0 && localSeconds > estimatedSeconds;
  const isIdle =
    timerState === TimerState.running && localSeconds / 60 > idleMinutes;
  const progressPct =
    estimatedSeconds > 0
      ? Math.min((localSeconds / estimatedSeconds) * 100, 100)
      : 0;

  const isMutating =
    startMut.isPending ||
    pauseMut.isPending ||
    resumeMut.isPending ||
    stopMut.isPending;

  return (
    <SectionCard title="Timer" icon={<Clock size={15} />}>
      <div className="space-y-4">
        {/* Overdue banner */}
        {isOverdue && timerState !== TimerState.stopped && (
          <div
            data-ocid="job_detail.timer.overdue_state"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200"
          >
            <AlertTriangle size={15} className="text-red-600 shrink-0" />
            <p className="text-xs font-bold text-red-700">
              OVERDUE — elapsed time exceeds estimated hours
            </p>
          </div>
        )}

        {/* Idle warning */}
        {isIdle && !isOverdue && (
          <div
            data-ocid="job_detail.timer.idle_state"
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200"
          >
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-700">
              Job has been running for over {idleMinutes} minutes — check for
              idle activity
            </p>
          </div>
        )}

        {/* Display */}
        <div className="flex items-center justify-between">
          <div>
            <p
              data-ocid="job_detail.timer.display"
              className={`timer-display ${isOverdue ? "text-red-600" : "text-foreground"}`}
            >
              {formatHHMMSS(localSeconds)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimated: {String(estimatedHours)}h (
              {formatHHMMSS(estimatedSeconds)})
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border
              ${timerState === TimerState.running ? "bg-blue-50 text-blue-700 border-blue-200" : ""}
              ${timerState === TimerState.paused ? "bg-amber-50 text-amber-700 border-amber-200" : ""}
              ${timerState === TimerState.stopped ? "bg-muted text-muted-foreground border-border" : ""}
            `}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full
                ${timerState === TimerState.running ? "bg-blue-500 animate-pulse" : ""}
                ${timerState === TimerState.paused ? "bg-amber-500" : ""}
                ${timerState === TimerState.stopped ? "bg-muted-foreground" : ""}
              `}
              />
              {timerState === TimerState.running
                ? "Running"
                : timerState === TimerState.paused
                  ? "Paused"
                  : "Stopped"}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {estimatedSeconds > 0 && (
          <div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${isOverdue ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {progressPct.toFixed(1)}% of estimated time
            </p>
          </div>
        )}

        {/* Controls */}
        {canControl && (
          <div
            data-ocid="job_detail.timer.controls"
            className="flex items-center gap-2 pt-1"
          >
            {timerState === TimerState.stopped && (
              <Button
                size="sm"
                onClick={() => startMut.mutate()}
                disabled={isMutating}
                data-ocid="job_detail.timer.start_button"
              >
                <Play size={14} className="mr-1" />
                Start
              </Button>
            )}
            {timerState === TimerState.running && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => pauseMut.mutate()}
                  disabled={isMutating}
                  data-ocid="job_detail.timer.pause_button"
                >
                  <Pause size={14} className="mr-1" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => stopMut.mutate()}
                  disabled={isMutating}
                  data-ocid="job_detail.timer.stop_button"
                >
                  <Square size={14} className="mr-1" />
                  Stop
                </Button>
              </>
            )}
            {timerState === TimerState.paused && (
              <>
                <Button
                  size="sm"
                  onClick={() => resumeMut.mutate()}
                  disabled={isMutating}
                  data-ocid="job_detail.timer.resume_button"
                >
                  <Play size={14} className="mr-1" />
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => stopMut.mutate()}
                  disabled={isMutating}
                  data-ocid="job_detail.timer.stop_button"
                >
                  <Square size={14} className="mr-1" />
                  Stop
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({
  open,
  onClose,
  jobId,
  workers,
  current,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  workers: Worker[];
  current: Assignment | null;
}) {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const [primaryId, setPrimaryId] = useState<string>("");
  const [assistIds, setAssistIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setPrimaryId(current?.primaryWorkerId?.toString() ?? "");
      setAssistIds(current?.assistWorkerIds?.map(String) ?? []);
    }
  }, [open, current]);

  const active = workers.filter((w) => w.status === WorkerStatus.active);

  const assignMut = useMutation({
    mutationFn: () =>
      actor!.assignWorkers({
        jobId,
        primaryWorkerId: BigInt(primaryId),
        assistWorkerIds: assistIds.map(BigInt),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment", jobId] });
      toast.success("Workers assigned");
      onClose();
    },
    onError: () => toast.error("Assignment failed"),
  });

  const toggleAssist = (id: string) => {
    setAssistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-ocid="job_detail.assign.dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Workers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Primary Worker</Label>
            <Select value={primaryId} onValueChange={setPrimaryId}>
              <SelectTrigger data-ocid="job_detail.assign.primary_select">
                <SelectValue placeholder="Select primary worker" />
              </SelectTrigger>
              <SelectContent>
                {active.map((w) => (
                  <SelectItem key={String(w.id)} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assist Workers</Label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {active
                .filter((w) => String(w.id) !== primaryId)
                .map((w) => (
                  <label
                    key={String(w.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={assistIds.includes(String(w.id))}
                      onChange={() => toggleAssist(String(w.id))}
                      className="accent-primary"
                    />
                    <span className="text-sm">{w.name}</span>
                  </label>
                ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="job_detail.assign.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => assignMut.mutate()}
            disabled={!primaryId || assignMut.isPending}
            data-ocid="job_detail.assign.confirm_button"
          >
            {assignMut.isPending ? "Saving…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reassign Modal ───────────────────────────────────────────────────────────

function ReassignModal({
  open,
  onClose,
  jobId,
  workers,
  current,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  workers: Worker[];
  current: Assignment | null;
}) {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"primary" | "assist">("primary");
  const [newPrimaryId, setNewPrimaryId] = useState<string>("");
  const [fromAssistId, setFromAssistId] = useState<string>("");
  const [toAssistId, setToAssistId] = useState<string>("");
  const [reason, setReason] = useState("");

  const active = workers.filter((w) => w.status === WorkerStatus.active);

  const reassignMut = useMutation({
    mutationFn: () => {
      if (mode === "primary") {
        return actor!.reassignPrimaryWorker({
          jobId,
          fromWorkerId: current!.primaryWorkerId,
          toWorkerId: BigInt(newPrimaryId),
          reason,
        });
      }
      return actor!.reassignAssistWorker({
        jobId,
        fromWorkerId: BigInt(fromAssistId),
        toWorkerId: BigInt(toAssistId),
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignment", jobId] });
      toast.success("Reassigned successfully");
      onClose();
    },
    onError: () => toast.error("Reassignment failed"),
  });

  const canSubmit =
    reason.trim().length > 0 &&
    (mode === "primary" ? !!newPrimaryId : !!fromAssistId && !!toAssistId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="job_detail.reassign.dialog"
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Reassign Worker</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "primary" ? "default" : "outline"}
              onClick={() => setMode("primary")}
              data-ocid="job_detail.reassign.primary_tab"
            >
              Primary
            </Button>
            <Button
              size="sm"
              variant={mode === "assist" ? "default" : "outline"}
              onClick={() => setMode("assist")}
              disabled={!current || current.assistWorkerIds.length === 0}
              data-ocid="job_detail.reassign.assist_tab"
            >
              Assist
            </Button>
          </div>

          {mode === "primary" && (
            <div className="space-y-1.5">
              <Label>New Primary Worker</Label>
              <Select value={newPrimaryId} onValueChange={setNewPrimaryId}>
                <SelectTrigger data-ocid="job_detail.reassign.new_primary_select">
                  <SelectValue placeholder="Select new primary" />
                </SelectTrigger>
                <SelectContent>
                  {active
                    .filter((w) => w.id !== current?.primaryWorkerId)
                    .map((w) => (
                      <SelectItem key={String(w.id)} value={String(w.id)}>
                        {w.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "assist" && (
            <>
              <div className="space-y-1.5">
                <Label>Replace Worker</Label>
                <Select value={fromAssistId} onValueChange={setFromAssistId}>
                  <SelectTrigger data-ocid="job_detail.reassign.from_assist_select">
                    <SelectValue placeholder="Worker to replace" />
                  </SelectTrigger>
                  <SelectContent>
                    {current?.assistWorkerIds.map((id) => (
                      <SelectItem key={String(id)} value={String(id)}>
                        {workerName(workers, id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>New Assist Worker</Label>
                <Select value={toAssistId} onValueChange={setToAssistId}>
                  <SelectTrigger data-ocid="job_detail.reassign.to_assist_select">
                    <SelectValue placeholder="Select replacement" />
                  </SelectTrigger>
                  <SelectContent>
                    {active
                      .filter(
                        (w) =>
                          !current?.assistWorkerIds.includes(w.id) &&
                          w.id !== current?.primaryWorkerId,
                      )
                      .map((w) => (
                        <SelectItem key={String(w.id)} value={String(w.id)}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required: explain the reason for reassignment"
              rows={3}
              data-ocid="job_detail.reassign.reason_input"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="job_detail.reassign.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => reassignMut.mutate()}
            disabled={!canSubmit || reassignMut.isPending}
            data-ocid="job_detail.reassign.confirm_button"
          >
            {reassignMut.isPending ? "Saving…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

function CancelModal({
  open,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-ocid="job_detail.cancel.dialog" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel Job</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-2">
          <Label>
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mandatory: provide cancellation reason"
            rows={3}
            data-ocid="job_detail.cancel.reason_input"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="job_detail.cancel.cancel_button"
          >
            Back
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || isPending}
            onClick={() => onConfirm(reason)}
            data-ocid="job_detail.cancel.confirm_button"
          >
            {isPending ? "Cancelling…" : "Cancel Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function JobDetail() {
  const params = useParams({ strict: false });
  const jobId = params.jobId ?? "";
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const enabled = !!actor && !isFetching && !!jobId;

  const { data: job, isLoading: jobLoading } = useQuery<Job | null>({
    queryKey: ["job", jobId],
    queryFn: () => actor!.getJob(jobId),
    enabled,
  });

  const { data: assignment } = useQuery<Assignment | null>({
    queryKey: ["assignment", jobId],
    queryFn: () => actor!.getAssignment(jobId),
    enabled,
  });

  const { data: timerData } = useQuery<TimerRecordView | null>({
    queryKey: ["timer", jobId],
    queryFn: () => actor!.getJobTimerState(jobId),
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data as TimerRecordView | null | undefined;
      return data?.state === TimerState.running ? 5000 : undefined;
    },
  });

  const { data: isOverdue } = useQuery<boolean | null>({
    queryKey: ["overdue", jobId],
    queryFn: () => actor!.isJobOverdue(jobId),
    enabled,
    refetchInterval: 30_000,
  });

  const { data: workers } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => actor!.listWorkers(null),
    enabled: !!actor && !isFetching,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => actor!.listActiveProducts(),
    enabled: !!actor && !isFetching,
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => actor!.getSettings(),
    enabled: !!actor && !isFetching,
  });

  const { data: auditEntries } = useQuery<AuditEntry[]>({
    queryKey: ["audit", jobId],
    queryFn: () =>
      actor!.queryAuditLog({
        entityId: jobId,
        entityType: AuditEntityType.job,
      }),
    enabled: enabled && role === "Admin",
  });

  const [showAssign, setShowAssign] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["job", jobId] });
    queryClient.invalidateQueries({ queryKey: ["timer", jobId] });
    queryClient.invalidateQueries({ queryKey: ["overdue", jobId] });
  }, [jobId, queryClient]);

  const statusMut = useMutation({
    mutationFn: (vars: { newStatus: JobStatus; note: string }) =>
      actor!.changeJobStatus({ jobId, ...vars }),
    onSuccess: () => {
      invalidate();
      toast.success("Status updated");
    },
    onError: () => toast.error("Status change failed"),
  });

  const cancelMut = useMutation({
    mutationFn: (reason: string) =>
      actor!.changeJobStatus({
        jobId,
        newStatus: JobStatus.cancelled,
        note: reason,
      }),
    onSuccess: () => {
      invalidate();
      setShowCancel(false);
      toast.success("Job cancelled");
    },
    onError: () => toast.error("Cancellation failed"),
  });

  const backPath =
    role === "Admin"
      ? "/admin/jobs"
      : role === "WorkshopManager"
        ? "/workshop/job-board"
        : "/sales/job-board";

  const isWorkshopManager = role === "WorkshopManager";
  const isSalesManager = role === "SalesManager";
  const isAdmin = role === "Admin";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (jobLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    );
  }

  if (!job) {
    return (
      <div data-ocid="job_detail.error_state" className="text-center py-20">
        <p className="text-sm text-muted-foreground">Job not found</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate({ to: backPath })}
          data-ocid="job_detail.back_button"
        >
          Back
        </Button>
      </div>
    );
  }

  const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);
  const jobProducts = job.productIds
    .map((id) => productMap.get(id))
    .filter(Boolean) as Product[];

  const currentStatus = job.status;
  const canStartJob =
    isWorkshopManager && currentStatus === JobStatus.pendingAssignment;
  const canPauseJob =
    isWorkshopManager && currentStatus === JobStatus.inProgress;
  const canCompleteJob =
    isWorkshopManager && currentStatus === JobStatus.inProgress;
  const canResumeJob = isWorkshopManager && currentStatus === JobStatus.paused;
  const canCancelJob =
    (isSalesManager || isAdmin) &&
    currentStatus !== JobStatus.cancelled &&
    currentStatus !== JobStatus.completed;

  return (
    <div data-ocid="job_detail.page" className="max-w-3xl space-y-5 pb-8">
      {/* Back */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: backPath })}
          data-ocid="job_detail.back_button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back
        </Button>
        {(isSalesManager || isAdmin) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: `/sales/jobs/${jobId}/edit` })}
            data-ocid="job_detail.edit_button"
          >
            <Settings2 size={14} className="mr-1" />
            Edit Job
          </Button>
        )}
      </div>

      {/* Header card */}
      <Card className="bg-card border border-border">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono text-muted-foreground tracking-wide">
                {job.jobId}
              </p>
              <h1 className="font-bold text-xl font-display text-foreground mt-1">
                {job.carMake} {job.carModel} ({Number(job.carYear)})
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-mono">
                {job.carPlate}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={job.priority} />
              <StatusBadge status={job.status} />
              {isOverdue && job.status === JobStatus.inProgress && (
                <Badge
                  data-ocid="job_detail.overdue_badge"
                  className="bg-red-100 text-red-800 border border-red-300 font-bold"
                >
                  OVERDUE
                </Badge>
              )}
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <div className="flex items-center gap-1.5 mt-1">
                <User size={13} className="text-muted-foreground" />
                <p className="text-sm font-medium truncate">
                  {job.customerName}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium mt-1">{job.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Complexity</p>
              <p className="text-sm font-medium mt-1">
                Level {Number(job.complexity)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Est. Hours</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock size={13} className="text-muted-foreground" />
                <p className="text-sm font-medium">
                  {Number(job.estimatedHours)}h
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Project Price</p>
              <div className="flex items-center gap-1.5 mt-1">
                <DollarSign size={13} className="text-muted-foreground" />
                <p className="text-sm font-medium">
                  AED {Number(job.projectPrice).toLocaleString()}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar size={13} className="text-muted-foreground" />
                <p className="text-sm font-medium">
                  {formatDate(job.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancellation notice */}
      {job.cancellationReason && (
        <div
          data-ocid="job_detail.cancellation_notice"
          className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200"
        >
          <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700">
              Cancellation Reason
            </p>
            <p className="text-sm text-red-800 mt-0.5">
              {job.cancellationReason}
            </p>
          </div>
        </div>
      )}

      {/* Work description */}
      <SectionCard title="Work Description" icon={<Wrench size={15} />}>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {job.description}
        </p>
      </SectionCard>

      {/* Products */}
      {job.productIds.length > 0 && (
        <SectionCard title="Products / Parts" icon={<Car size={15} />}>
          {jobProducts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {jobProducts.map((p, i) => (
                <Badge
                  key={String(p.id)}
                  data-ocid={`job_detail.product.item.${i + 1}`}
                  variant="secondary"
                  className="text-xs"
                >
                  {p.code ? `[${p.code}] ` : ""}
                  {p.name}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {job.productIds.length} product(s) referenced (details loading…)
            </p>
          )}
        </SectionCard>
      )}

      {/* Timer */}
      <TimerSection
        jobId={jobId}
        timerData={timerData ?? null}
        estimatedHours={job.estimatedHours}
        settings={settings ?? null}
        canControl={isWorkshopManager}
        onRefresh={invalidate}
      />

      {/* Status actions */}
      {(canStartJob ||
        canPauseJob ||
        canCompleteJob ||
        canResumeJob ||
        canCancelJob) && (
        <Card className="bg-card border border-border">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Job Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {canStartJob && (
                <Button
                  size="sm"
                  onClick={() =>
                    statusMut.mutate({
                      newStatus: JobStatus.inProgress,
                      note: "Job started",
                    })
                  }
                  disabled={statusMut.isPending}
                  data-ocid="job_detail.action.start_button"
                >
                  <Play size={14} className="mr-1" />
                  Start Job
                </Button>
              )}
              {canPauseJob && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    statusMut.mutate({
                      newStatus: JobStatus.paused,
                      note: "Job paused",
                    })
                  }
                  disabled={statusMut.isPending}
                  data-ocid="job_detail.action.pause_button"
                >
                  <Pause size={14} className="mr-1" />
                  Pause Job
                </Button>
              )}
              {canResumeJob && (
                <Button
                  size="sm"
                  onClick={() =>
                    statusMut.mutate({
                      newStatus: JobStatus.inProgress,
                      note: "Job resumed",
                    })
                  }
                  disabled={statusMut.isPending}
                  data-ocid="job_detail.action.resume_button"
                >
                  <Play size={14} className="mr-1" />
                  Resume Job
                </Button>
              )}
              {canCompleteJob && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() =>
                    statusMut.mutate({
                      newStatus: JobStatus.completed,
                      note: "Job completed",
                    })
                  }
                  disabled={statusMut.isPending}
                  data-ocid="job_detail.action.complete_button"
                >
                  Complete Job
                </Button>
              )}
              {canCancelJob && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowCancel(true)}
                  data-ocid="job_detail.action.cancel_button"
                >
                  Cancel Job
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment */}
      <SectionCard
        title="Worker Assignment"
        icon={<Users size={15} />}
        action={
          isWorkshopManager ? (
            <div className="flex gap-1.5">
              {!assignment && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAssign(true)}
                  data-ocid="job_detail.assignment.assign_button"
                >
                  <UserPlus size={13} className="mr-1" />
                  Assign
                </Button>
              )}
              {assignment && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAssign(true)}
                    data-ocid="job_detail.assignment.reassign_primary_button"
                  >
                    <UserPlus size={13} className="mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReassign(true)}
                    data-ocid="job_detail.assignment.reassign_button"
                  >
                    <UserMinus size={13} className="mr-1" />
                    Reassign
                  </Button>
                </>
              )}
            </div>
          ) : null
        }
      >
        {assignment ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Primary Worker</p>
                <p
                  data-ocid="job_detail.assignment.primary_worker"
                  className="text-sm font-semibold"
                >
                  {workerName(workers ?? [], assignment.primaryWorkerId)}
                </p>
              </div>
            </div>
            {assignment.assistWorkerIds.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Assist Workers
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignment.assistWorkerIds.map((id, i) => (
                    <Badge
                      key={String(id)}
                      data-ocid={`job_detail.assignment.assist.${i + 1}`}
                      variant="secondary"
                    >
                      {workerName(workers ?? [], id)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {assignment.reassignmentHistory.length > 0 && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">
                  Reassignment History
                </p>
                <div className="space-y-1.5">
                  {assignment.reassignmentHistory.map((r, i) => (
                    <div
                      key={`${r.fromWorkerId}-${r.timestamp}`}
                      data-ocid={`job_detail.reassign_history.${i + 1}`}
                      className="text-xs text-muted-foreground"
                    >
                      {workerName(workers ?? [], r.fromWorkerId)} →{" "}
                      {workerName(workers ?? [], r.toWorkerId)} •{" "}
                      {formatDate(r.timestamp)}
                      {r.reason && (
                        <span className="italic"> — {r.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p
            data-ocid="job_detail.assignment.empty_state"
            className="text-sm text-muted-foreground"
          >
            No workers assigned yet
          </p>
        )}
      </SectionCard>

      {/* Status History */}
      <SectionCard title="Status History" icon={<History size={15} />}>
        {job.statusHistory.length === 0 ? (
          <p
            data-ocid="job_detail.history.empty_state"
            className="text-sm text-muted-foreground"
          >
            No history yet
          </p>
        ) : (
          <div className="relative pl-4 space-y-4">
            <div className="absolute left-1.5 top-2 bottom-2 w-px bg-border" />
            {[...job.statusHistory].reverse().map((entry, i) => (
              <div
                key={`${entry.status}-${entry.timestamp.toString()}`}
                data-ocid={`job_detail.history.item.${i + 1}`}
                className="flex items-start gap-3 relative"
              >
                <div className="absolute -left-[11px] w-2.5 h-2.5 rounded-full bg-primary border-2 border-background mt-1" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={entry.status} />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                  {entry.note && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {entry.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Audit log (Admin only) */}
      {isAdmin && (
        <SectionCard title="Audit Log" icon={<Shield size={15} />}>
          {!auditEntries || auditEntries.length === 0 ? (
            <p
              data-ocid="job_detail.audit.empty_state"
              className="text-sm text-muted-foreground"
            >
              No audit entries
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {auditEntries.slice(0, 20).map((entry, i) => (
                <div
                  key={String(entry.id)}
                  data-ocid={`job_detail.audit.item.${i + 1}`}
                  className="flex items-start gap-2 py-2 border-b border-border last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {entry.action}
                    </p>
                    {entry.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.details}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(entry.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Modals */}
      <AssignModal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        jobId={jobId}
        workers={workers ?? []}
        current={assignment ?? null}
      />
      <ReassignModal
        open={showReassign}
        onClose={() => setShowReassign(false)}
        jobId={jobId}
        workers={workers ?? []}
        current={assignment ?? null}
      />
      <CancelModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={(reason) => cancelMut.mutate(reason)}
        isPending={cancelMut.isPending}
      />
    </div>
  );
}
