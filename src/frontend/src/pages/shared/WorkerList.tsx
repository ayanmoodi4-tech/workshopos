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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  UserCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { WorkerStatus } from "../../backend";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";
import type { CreateWorkerInput, Worker } from "../../types";

const PAGE_SIZE = 25;

function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  return status === WorkerStatus.active ? (
    <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-300">
      Inactive
    </span>
  );
}

interface AddWorkerForm extends CreateWorkerInput {
  biometricEmployeeId?: string;
}

function AddWorkerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { actor } = useBackendActor();
  const [form, setForm] = useState<AddWorkerForm>({
    name: "",
    phone: "",
    email: "",
    biometricEmployeeId: "",
  });

  const mutation = useMutation({
    mutationFn: async (input: CreateWorkerInput) => {
      if (!actor) throw new Error("Not connected");
      return actor.createWorker(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker added successfully");
      onClose();
      setForm({ name: "", phone: "", email: "", biometricEmployeeId: "" });
    },
    onError: () => toast.error("Failed to add worker"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Name, phone, and email are required");
      return;
    }
    const bioId = form.biometricEmployeeId?.trim();
    mutation.mutate({
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
        data-ocid="add-worker.dialog"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Add New Worker</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="worker-name">Full Name *</Label>
            <Input
              id="worker-name"
              data-ocid="add-worker.name.input"
              placeholder="e.g. Ahmed Al-Rashid"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="worker-phone">Phone *</Label>
            <Input
              id="worker-phone"
              data-ocid="add-worker.phone.input"
              placeholder="+971 50 123 4567"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="worker-email">Email *</Label>
            <Input
              id="worker-email"
              data-ocid="add-worker.email.input"
              type="email"
              placeholder="ahmed@workshop.ae"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="worker-biometric">Biometric Employee ID</Label>
            <Input
              id="worker-biometric"
              data-ocid="add-worker.biometric.input"
              placeholder="EMP-001 (optional)"
              value={form.biometricEmployeeId ?? ""}
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
              data-ocid="add-worker.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-ocid="add-worker.submit_button"
            >
              {mutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Add Worker
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkerList() {
  const { role } = useAuth();
  const { actor, isFetching } = useBackendActor();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const backendStatus =
    statusFilter === "active"
      ? WorkerStatus.active
      : statusFilter === "inactive"
        ? WorkerStatus.inactive
        : null;

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["workers", backendStatus],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listWorkers(backendStatus);
    },
    enabled: !!actor && !isFetching,
  });

  // Fetch all jobs to get counts per worker
  const { data: allJobs = [] } = useQuery({
    queryKey: ["all-jobs-list"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAllJobs();
    },
    enabled: !!actor && !isFetching,
  });

  // listJobsByWorker requires individual calls per worker; show "—" until detail page
  const getJobCount = (_workerId: bigint): string => "—";

  // Suppress unused allJobs variable — kept for future per-worker counts
  void allJobs;

  const filtered = workers.filter((w) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.email.toLowerCase().includes(q) ||
      (w.biometricEmployeeId ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val as "all" | "active" | "inactive");
    setPage(1);
  };

  const goToWorker = (id: bigint) => {
    const base = role === "Admin" ? "/admin/workers" : "/workshop/workers";
    navigate({ to: `${base}/${id}` });
  };

  return (
    <div data-ocid="worker_list.page" className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-foreground">
            Workers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage workshop staff profiles and history
          </p>
        </div>
        {role === "Admin" && (
          <Button
            onClick={() => setShowAddModal(true)}
            data-ocid="worker_list.add_button"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Worker
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            data-ocid="worker_list.search_input"
            className="pl-9"
            placeholder="Search name, email, biometric ID…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40" data-ocid="worker_list.status.select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Workers</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">
                  Biometric ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">
                  Jobs
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }, (__, i) => `sk-${i}`).map((key) => (
                  <tr
                    key={key}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-5 w-16 rounded-md" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-right">
                      <Skeleton className="h-4 w-6 ml-auto" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Skeleton className="h-8 w-16 ml-auto rounded" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    data-ocid="worker_list.empty_state"
                    className="px-4 py-16 text-center"
                  >
                    <UserCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No workers found
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {search
                        ? "Try a different search term"
                        : "Add your first worker to get started"}
                    </p>
                  </td>
                </tr>
              ) : (
                paginated.map((worker, idx) => {
                  const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                  return (
                    <tr
                      key={String(worker.id)}
                      data-ocid={`worker_list.item.${rowNum}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => goToWorker(worker.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          goToWorker(worker.id);
                      }}
                      tabIndex={0}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                            {worker.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[140px]">
                            {worker.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {worker.phone}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[200px]">
                        {worker.email}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {worker.biometricEmployeeId ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {worker.biometricEmployeeId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <WorkerStatusBadge status={worker.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-sm hidden sm:table-cell">
                        {getJobCount(worker.id)}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          data-ocid={`worker_list.view_button.${rowNum}`}
                          onClick={() => goToWorker(worker.id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-sm text-muted-foreground">
          <span>
            {isLoading
              ? "Loading…"
              : `${filtered.length} worker${filtered.length !== 1 ? "s" : ""}${filtered.length !== workers.length ? ` (filtered from ${workers.length})` : ""}`}
          </span>
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-ocid="worker_list.pagination_prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-ocid="worker_list.pagination_next"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <AddWorkerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
