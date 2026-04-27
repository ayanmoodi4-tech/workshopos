import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Fingerprint,
  Loader2,
  Mail,
  Pencil,
  Phone,
  UserX,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuditEntityType, WorkerStatus } from "../../backend";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";
import type {
  AttendanceRecord,
  AuditEntry,
  IncentiveLedgerEntry,
  Job,
  UpdateWorkerInput,
  Worker,
} from "../../types";

// ── helpers ─────────────────────────────────────────────────────────────────

function fmtTs(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtTsTime(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtCurrency(amount: bigint): string {
  return `AED ${Number(amount).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`;
}

// ── Edit Worker Modal ────────────────────────────────────────────────────────

function EditWorkerModal({
  worker,
  open,
  onClose,
}: {
  worker: Worker;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { actor } = useBackendActor();
  const [form, setForm] = useState<UpdateWorkerInput>({
    id: worker.id,
    name: worker.name,
    phone: worker.phone,
    email: worker.email,
    biometricEmployeeId: worker.biometricEmployeeId ?? "",
  });

  const mutation = useMutation({
    mutationFn: async (input: UpdateWorkerInput) => {
      if (!actor) throw new Error("Not connected");
      return actor.updateWorker(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["worker", String(worker.id)],
      });
      toast.success("Worker updated");
      onClose();
    },
    onError: () => toast.error("Failed to update worker"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Name, phone, and email are required");
      return;
    }
    const bioId = (form.biometricEmployeeId as string | undefined)?.trim();
    mutation.mutate({
      id: worker.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      biometricEmployeeId: bioId || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="max-w-md"
        data-ocid="edit-worker.dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Edit Worker</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name *</Label>
            <Input
              id="edit-name"
              data-ocid="edit-worker.name.input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Phone *</Label>
            <Input
              id="edit-phone"
              data-ocid="edit-worker.phone.input"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              data-ocid="edit-worker.email.input"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-biometric">Biometric Employee ID</Label>
            <Input
              id="edit-biometric"
              data-ocid="edit-worker.biometric.input"
              value={(form.biometricEmployeeId as string | undefined) ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  biometricEmployeeId: e.target.value,
                }))
              }
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="edit-worker.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-ocid="edit-worker.save_button"
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Job History Tab ──────────────────────────────────────────────────────────

function JobHistoryTab({ jobs, loading }: { jobs: Job[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div
        data-ocid="worker_detail.jobs.empty_state"
        className="py-12 text-center text-sm text-muted-foreground"
      >
        No jobs assigned yet
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Job ID
            </th>
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
              Vehicle
            </th>
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </th>
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job, i) => (
            <tr
              key={job.jobId}
              data-ocid={`worker_detail.job.${i + 1}`}
              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                {job.jobId}
              </td>
              <td className="py-2.5 px-3 font-medium text-foreground hidden md:table-cell">
                {job.carMake} {job.carModel}{" "}
                <span className="text-muted-foreground text-xs">
                  ({String(job.carYear)})
                </span>
              </td>
              <td className="py-2.5 px-3">
                <StatusBadge status={job.status} />
              </td>
              <td className="py-2.5 px-3 text-muted-foreground hidden lg:table-cell">
                {fmtTs(job.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Incentive Ledger Tab ─────────────────────────────────────────────────────

function IncentiveLedgerTab({
  entries,
  loading,
}: {
  entries: IncentiveLedgerEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div
        data-ocid="worker_detail.incentives.empty_state"
        className="py-12 text-center text-sm text-muted-foreground"
      >
        No incentive records yet
      </div>
    );
  }
  const total = entries.reduce((sum, e) => sum + e.amount, 0n);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Job ID
              </th>
              <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Amount
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                Early Bonus
              </th>
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr
                key={`${entry.jobId}-${String(entry.distributedAt)}`}
                data-ocid={`worker_detail.incentive.${i + 1}`}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">
                  {entry.jobId}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                  {fmtCurrency(entry.amount)}
                </td>
                <td className="py-2.5 px-3 hidden sm:table-cell">
                  {entry.earlyBonus ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Yes
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                  {fmtTs(entry.distributedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 px-3 py-2.5 bg-muted/30 rounded-md border border-border flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Total earned</span>
        <span className="font-semibold text-foreground">
          {fmtCurrency(total)}
        </span>
      </div>
    </div>
  );
}

// ── Attendance Records Tab ───────────────────────────────────────────────────

function AttendanceTab({
  records,
  loading,
}: {
  records: AttendanceRecord[];
  loading: boolean;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [year, month] = viewMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const byDate = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (r.date.startsWith(viewMonth)) byDate.set(r.date, r);
  }

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setViewMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setViewMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  };

  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }

  const monthName = new Date(year, month - 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const tableRecords = records.filter((r) => r.date.startsWith(viewMonth));

  return (
    <div className="space-y-5">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={prevMonth}
          data-ocid="worker_detail.attendance.prev_month"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {monthName}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={nextMonth}
          data-ocid="worker_detail.attendance.next_month"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            className="text-center font-semibold text-muted-foreground py-1"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: firstDay }, (_, i) => `blank-${i}`).map((key) => (
          <div key={key} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${viewMonth}-${String(day).padStart(2, "0")}`;
          const rec = byDate.get(dateStr);
          let cls =
            "rounded-md py-1.5 text-center border transition-colors text-xs ";
          if (!rec) cls += "bg-muted/20 border-border text-muted-foreground/50";
          else if (rec.isAbsent)
            cls += "bg-red-100 border-red-200 text-red-700 font-semibold";
          else if (rec.isLate)
            cls += "bg-amber-100 border-amber-200 text-amber-700 font-semibold";
          else
            cls +=
              "bg-emerald-100 border-emerald-200 text-emerald-700 font-semibold";
          return (
            <div key={dateStr} className={cls} title={dateStr}>
              {day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200 inline-block" />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 inline-block" />
          Late
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block" />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-muted/40 border border-border inline-block" />
          No record
        </span>
      </div>

      {/* Table for the month */}
      {tableRecords.length > 0 ? (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Date
                </th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Check-in
                </th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Check-out
                </th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRecords.map((r, i) => (
                <tr
                  key={String(r.id)}
                  data-ocid={`worker_detail.attendance.${i + 1}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2 px-3 text-sm text-foreground font-medium">
                    {r.date}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {r.checkInAt ? fmtTsTime(r.checkInAt) : "—"}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {r.checkOutAt ? fmtTsTime(r.checkOutAt) : "—"}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1.5">
                      {r.isLate && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 border border-amber-200">
                          Late
                        </span>
                      )}
                      {r.isAbsent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 border border-red-200">
                          Absent
                        </span>
                      )}
                      {!r.isLate && !r.isAbsent && (
                        <span className="text-xs text-muted-foreground/60">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p
          data-ocid="worker_detail.attendance.empty_state"
          className="text-sm text-muted-foreground text-center py-6"
        >
          No attendance records for {monthName}
        </p>
      )}
    </div>
  );
}

// ── Audit Trail Tab ──────────────────────────────────────────────────────────

function AuditTrailTab({
  entries,
  loading,
}: {
  entries: AuditEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div
        data-ocid="worker_detail.audit.empty_state"
        className="py-12 text-center text-sm text-muted-foreground"
      >
        No audit trail entries yet
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div
          key={String(entry.id)}
          data-ocid={`worker_detail.audit.${i + 1}`}
          className="flex gap-3 py-2.5 border-b border-border last:border-0"
        >
          <div className="mt-0.5 w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground truncate">
                {entry.action}
              </p>
              <time className="text-xs text-muted-foreground shrink-0">
                {fmtTs(entry.timestamp)} {fmtTsTime(entry.timestamp)}
              </time>
            </div>
            {entry.details && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {entry.details}
              </p>
            )}
            <p className="text-xs text-muted-foreground/60 font-mono mt-0.5 truncate">
              {entry.actorPrincipal.toString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function WorkerDetail() {
  const params = useParams({ strict: false });
  const workerId = BigInt((params as { workerId?: string }).workerId ?? "0");
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [activeTab, setActiveTab] = useState("jobs");

  const backPath = role === "Admin" ? "/admin/workers" : "/workshop/workers";

  // Queries
  const { data: worker, isLoading } = useQuery<Worker | null>({
    queryKey: ["worker", String(workerId)],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getWorker(workerId);
    },
    enabled: !!actor && !isFetching && workerId > 0n,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["workerJobs", String(workerId)],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listJobsByWorker(workerId);
    },
    enabled: !!actor && !isFetching && workerId > 0n,
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery<
    IncentiveLedgerEntry[]
  >({
    queryKey: ["workerLedger", String(workerId)],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getWorkerLedger(workerId);
    },
    enabled: !!actor && !isFetching && workerId > 0n,
  });

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery<
    AttendanceRecord[]
  >({
    queryKey: ["workerAttendance", String(workerId)],
    queryFn: async () => {
      if (!actor) return [];
      return actor.queryAttendance({ workerId });
    },
    enabled: !!actor && !isFetching && workerId > 0n,
  });

  const { data: auditEntries = [], isLoading: auditLoading } = useQuery<
    AuditEntry[]
  >({
    queryKey: ["workerAudit", String(workerId)],
    queryFn: async () => {
      if (!actor) return [];
      return actor.queryAuditLog({
        entityType: AuditEntityType.worker,
        entityId: String(workerId),
      });
    },
    enabled: !!actor && !isFetching && workerId > 0n,
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.deactivateWorker(workerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker", String(workerId)] });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker deactivated");
      setShowDeactivate(false);
    },
    onError: () => toast.error("Failed to deactivate worker"),
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // Not found
  if (!worker) {
    return (
      <div
        data-ocid="worker_detail.error_state"
        className="flex flex-col items-center justify-center py-20 gap-3"
      >
        <AlertTriangle className="w-10 h-10 text-destructive/60" />
        <p className="text-sm font-medium text-foreground">Worker not found</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: backPath })}
          data-ocid="worker_detail.back_button"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Workers
        </Button>
      </div>
    );
  }

  const isActive = worker.status === WorkerStatus.active;

  return (
    <div data-ocid="worker_detail.page" className="max-w-4xl space-y-5">
      {/* Back nav */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: backPath })}
        data-ocid="worker_detail.back_button"
        className="-ml-2"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Workers
      </Button>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
            {worker.name.charAt(0).toUpperCase()}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-display font-semibold text-foreground">
                {worker.name}
              </h1>
              {isActive ? (
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-300">
                  Inactive
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-6 text-sm text-muted-foreground mt-3">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{worker.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{worker.email}</span>
              </div>
              {worker.biometricEmployeeId && (
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono text-xs">
                    {worker.biometricEmployeeId}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Joined {fmtTs(worker.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Actions (Admin only) */}
          {role === "Admin" && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEdit(true)}
                data-ocid="worker_detail.edit_button"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
              {isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setShowDeactivate(true)}
                  data-ocid="worker_detail.deactivate_button"
                >
                  <UserX className="w-3.5 h-3.5 mr-1.5" />
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-ocid="worker_detail.tabs"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="jobs" data-ocid="worker_detail.jobs.tab">
            Job History
            {jobs.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({jobs.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="incentives"
            data-ocid="worker_detail.incentives.tab"
          >
            Incentive Ledger
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            data-ocid="worker_detail.attendance.tab"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger value="audit" data-ocid="worker_detail.audit.tab">
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 bg-card border border-border rounded-xl p-5">
          <TabsContent value="jobs" className="mt-0">
            <JobHistoryTab jobs={jobs} loading={jobsLoading} />
          </TabsContent>
          <TabsContent value="incentives" className="mt-0">
            <IncentiveLedgerTab entries={ledger} loading={ledgerLoading} />
          </TabsContent>
          <TabsContent value="attendance" className="mt-0">
            <AttendanceTab records={attendance} loading={attendanceLoading} />
          </TabsContent>
          <TabsContent value="audit" className="mt-0">
            <AuditTrailTab entries={auditEntries} loading={auditLoading} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit modal */}
      {showEdit && (
        <EditWorkerModal
          worker={worker}
          open={showEdit}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Deactivate confirmation */}
      <AlertDialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <AlertDialogContent data-ocid="deactivate-worker.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Worker</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{worker.name}</strong>
              ? This will mark them as inactive. This action is logged and
              cannot be undone — the worker profile will be retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="deactivate-worker.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="deactivate-worker.confirm_button"
            >
              {deactivateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
