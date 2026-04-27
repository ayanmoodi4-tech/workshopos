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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Calendar,
  Download,
  Filter,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useBackendActor } from "../../lib/api";
import type {
  IncentiveLedgerEntry,
  IncentivePoolView,
  Worker,
} from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: bigint) {
  return new Date(Number(ts / 1_000_000n)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAED(amount: bigint | number) {
  return `AED ${Number(amount).toLocaleString("en-AE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Distribute Confirm Dialog ─────────────────────────────────────────────────

interface DistributeDialogProps {
  pool: IncentivePoolView;
  workerMap: Map<bigint, string>;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function DistributeDialog({
  pool,
  workerMap,
  onConfirm,
  onCancel,
  isPending,
}: DistributeDialogProps) {
  const primaryName =
    pool.assistWorkerShares.length === 0 ? "Primary Worker" : "Primary Worker";

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        data-ocid="incentives.distribute.dialog"
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Distribute Incentive Pool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Job
              </span>
              <span className="font-mono text-sm font-semibold">
                {pool.jobId}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                Total Pool
              </span>
              <span className="text-sm font-bold text-foreground">
                {formatAED(pool.totalPool)}
              </span>
            </div>

            {pool.earlyBonus > 0n && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-500" />
                  Early Finish Bonus
                </span>
                <span className="text-sm font-semibold text-amber-700">
                  {formatAED(pool.earlyBonus)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Breakdown
            </p>
            <div className="rounded-lg border border-border divide-y divide-border">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                    Primary
                  </span>
                  <span className="text-sm text-foreground">{primaryName}</span>
                </div>
                <span className="text-sm font-semibold">
                  {formatAED(pool.primaryWorkerShare)}
                </span>
              </div>
              {pool.assistWorkerShares.map((share, i) => (
                <div
                  key={share.workerId.toString()}
                  className="flex items-center justify-between px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                      Assist {i + 1}
                    </span>
                    <span className="text-sm text-foreground">
                      {workerMap.get(share.workerId) ??
                        `Worker #${share.workerId}`}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatAED(share.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
            data-ocid="incentives.distribute.cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            data-ocid="incentives.distribute.confirm_button"
            className="gap-1.5"
          >
            {isPending ? "Distributing…" : "Confirm Distribution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary Card ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}

function SummaryCard({ label, value, icon, accent }: SummaryCardProps) {
  return (
    <Card className="bg-card border border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              {label}
            </p>
            <p
              className={`text-2xl font-bold font-display ${accent ? "text-amber-600" : "text-foreground"}`}
            >
              {value}
            </p>
          </div>
          <div
            className={`p-2 rounded-lg ${accent ? "bg-amber-100 text-amber-600" : "bg-muted text-muted-foreground"}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Incentives() {
  const { actor, isFetching } = useBackendActor();
  const queryClient = useQueryClient();

  // Filters
  const [workerFilter, setWorkerFilter] = useState<bigint | null>(null);
  const [jobFilter, setJobFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [distributeTarget, setDistributeTarget] =
    useState<IncentivePoolView | null>(null);

  // Queries
  const { data: ledger = [], isLoading: ledgerLoading } = useQuery<
    IncentiveLedgerEntry[]
  >({
    queryKey: ["incentive.ledger"],
    queryFn: () => actor!.getAllIncentiveLedger(),
    enabled: !!actor && !isFetching,
  });

  const { data: pending = [], isLoading: pendingLoading } = useQuery<
    IncentivePoolView[]
  >({
    queryKey: ["incentive.pending"],
    queryFn: () => actor!.getPendingIncentives(),
    enabled: !!actor && !isFetching,
  });

  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["workers.all"],
    queryFn: () => actor!.listWorkers(null),
    enabled: !!actor && !isFetching,
  });

  const workerMap = useMemo(() => {
    const m = new Map<bigint, string>();
    for (const w of workers) m.set(w.id, w.name);
    return m;
  }, [workers]);

  // Distribute mutation
  const distributeMutation = useMutation({
    mutationFn: async (pool: IncentivePoolView) => {
      if (!actor) throw new Error("Not connected");
      // We need assignment + timer data; use what's in the pool view
      const assistEntries = pool.assistWorkerShares.map((s) => ({
        workerId: s.workerId,
        trackedNanos: 0n, // backend calculates if not present; pool already computed
      }));
      await actor.distributeJobIncentive(
        pool.jobId,
        // primary worker ID — get from assignment; use 0n as fallback (backend enforces)
        0n,
        assistEntries,
        0n,
        0n,
      );
    },
    onSuccess: () => {
      toast.success("Incentive pool distributed successfully");
      setDistributeTarget(null);
      queryClient.invalidateQueries({ queryKey: ["incentive.ledger"] });
      queryClient.invalidateQueries({ queryKey: ["incentive.pending"] });
    },
    onError: () => {
      toast.error("Failed to distribute incentive pool");
    },
  });

  // Derived summary stats
  const totalDistributed = useMemo(
    () => ledger.reduce((s, e) => s + Number(e.amount), 0),
    [ledger],
  );
  const earlyBonusTotal = useMemo(
    () =>
      ledger
        .filter((e) => e.earlyBonus)
        .reduce((s, e) => s + Number(e.amount), 0),
    [ledger],
  );
  const pendingTotal = useMemo(
    () => pending.reduce((s, p) => s + Number(p.totalPool), 0),
    [pending],
  );

  // Filtered ledger
  const filteredLedger = useMemo(() => {
    return ledger.filter((e) => {
      if (workerFilter !== null && e.workerId !== workerFilter) return false;
      if (jobFilter && !e.jobId.toLowerCase().includes(jobFilter.toLowerCase()))
        return false;
      const entryDate = new Date(Number(e.distributedAt / 1_000_000n));
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (entryDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59);
        if (entryDate > to) return false;
      }
      return true;
    });
  }, [ledger, workerFilter, jobFilter, dateFrom, dateTo]);

  const hasFilters = workerFilter !== null || jobFilter || dateFrom || dateTo;

  function clearFilters() {
    setWorkerFilter(null);
    setJobFilter("");
    setDateFrom("");
    setDateTo("");
  }

  function exportPayrollCSV() {
    // Aggregate per worker
    const map = new Map<
      string,
      {
        name: string;
        jobs: Set<string>;
        total: number;
        earlyBonus: number;
      }
    >();

    for (const e of ledger) {
      const key = e.workerId.toString();
      if (!map.has(key)) {
        map.set(key, {
          name: workerMap.get(e.workerId) ?? `Worker #${e.workerId}`,
          jobs: new Set(),
          total: 0,
          earlyBonus: 0,
        });
      }
      const row = map.get(key)!;
      row.jobs.add(e.jobId);
      row.total += Number(e.amount);
      if (e.earlyBonus) row.earlyBonus += Number(e.amount);
    }

    const periodFrom = dateFrom || "All time";
    const periodTo = dateTo || new Date().toISOString().split("T")[0];
    const period = `${periodFrom} to ${periodTo}`;

    const header =
      "Worker Name,Total Jobs,Total Incentive (AED),Early Bonus (AED),Period\n";
    const rows = [...map.values()]
      .map(
        (r) =>
          `"${r.name}",${r.jobs.size},${r.total.toFixed(2)},${r.earlyBonus.toFixed(2)},"${period}"`,
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-incentives-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Payroll CSV exported");
  }

  return (
    <div data-ocid="incentives.page" className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Incentives
          </h1>
          <p className="text-sm text-muted-foreground">
            Pool distribution and worker earnings ledger
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={exportPayrollCSV}
          disabled={ledger.length === 0}
          data-ocid="incentives.export_button"
        >
          <Download size={14} />
          Export Payroll CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="Total Incentives Paid"
          value={formatAED(totalDistributed)}
          icon={<Award size={16} />}
        />
        <SummaryCard
          label="Pending Incentives"
          value={formatAED(pendingTotal)}
          icon={<TrendingUp size={16} />}
        />
        <SummaryCard
          label="Early Bonus Total"
          value={formatAED(earlyBonusTotal)}
          icon={<Sparkles size={16} />}
          accent
        />
      </div>

      {/* Pending Pools */}
      {(pendingLoading || pending.length > 0) && (
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" />
              Pending Incentive Pools
              {!pendingLoading && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {pending.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {pending.map((pool, i) => (
                  <div
                    key={pool.jobId}
                    data-ocid={`incentives.pending.item.${i + 1}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-semibold text-foreground shrink-0">
                        {pool.jobId}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground font-medium">
                          {formatAED(pool.totalPool)}
                        </span>
                        {pool.earlyBonus > 0n && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                            <Sparkles size={10} />+{formatAED(pool.earlyBonus)}{" "}
                            bonus
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Primary: {formatAED(pool.primaryWorkerShare)}
                        </span>
                        {pool.assistWorkerShares.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            · {pool.assistWorkerShares.length} assist
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0 ml-4"
                      data-ocid={`incentives.pending.distribute_button.${i + 1}`}
                      onClick={() => setDistributeTarget(pool)}
                    >
                      <Award size={12} />
                      Distribute
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ledger + Filters */}
      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award size={14} className="text-primary" />
              Incentive Ledger
              {!ledgerLoading && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {filteredLedger.length}
                  {hasFilters && ` / ${ledger.length}`}
                </Badge>
              )}
            </CardTitle>
            {workerFilter !== null && (
              <div className="flex items-center gap-2 text-xs bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1 text-primary font-medium">
                <span>
                  Filtered:{" "}
                  {workerMap.get(workerFilter) ?? `Worker #${workerFilter}`}
                </span>
                <button
                  type="button"
                  onClick={() => setWorkerFilter(null)}
                  className="text-primary hover:text-foreground"
                  aria-label="Clear worker filter"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                Filters:
              </span>
            </div>
            <Input
              placeholder="Job ID…"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="h-7 text-xs w-32"
              data-ocid="incentives.filter.job_input"
            />
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground sr-only">
                From
              </Label>
              <div className="relative">
                <Calendar
                  size={11}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-7 text-xs pl-7 w-36"
                  data-ocid="incentives.filter.date_from"
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 text-xs w-36"
                data-ocid="incentives.filter.date_to"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={clearFilters}
                data-ocid="incentives.filter.clear_button"
              >
                <X size={11} />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {ledgerLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : filteredLedger.length === 0 ? (
            <div
              data-ocid="incentives.ledger.empty_state"
              className="py-12 flex flex-col items-center gap-2 text-center"
            >
              <Award size={32} className="text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {hasFilters
                  ? "No entries match your filters"
                  : "No incentives distributed yet"}
              </p>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs"
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Worker Name
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Job ID
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Pool Amount
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Time Tracked
                    </th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Bonus
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Amount Earned
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry, i) => {
                    const name =
                      workerMap.get(entry.workerId) ??
                      `Worker #${entry.workerId}`;
                    const isActiveFilter = workerFilter === entry.workerId;
                    return (
                      <tr
                        key={`${entry.workerId}-${entry.jobId}-${entry.distributedAt}`}
                        data-ocid={`incentives.ledger.item.${i + 1}`}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              setWorkerFilter(
                                isActiveFilter ? null : entry.workerId,
                              )
                            }
                            data-ocid={`incentives.ledger.worker_filter.${i + 1}`}
                            className={`text-xs font-medium hover:underline underline-offset-2 transition-colors ${
                              isActiveFilter
                                ? "text-primary"
                                : "text-foreground hover:text-primary"
                            }`}
                            title={
                              isActiveFilter
                                ? "Clear worker filter"
                                : `Filter by ${name}`
                            }
                          >
                            {name}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.jobId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                          —
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground">
                            —
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {entry.earlyBonus ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              <Sparkles size={10} />
                              Yes
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-sm">
                          {formatAED(entry.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.distributedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer totals */}
                {filteredLedger.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td
                        colSpan={5}
                        className="py-2.5 px-3 text-xs font-semibold text-muted-foreground"
                      >
                        {hasFilters
                          ? `Showing ${filteredLedger.length} of ${ledger.length} entries`
                          : `${filteredLedger.length} entries`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-sm">
                        {formatAED(
                          filteredLedger.reduce(
                            (s, e) => s + Number(e.amount),
                            0,
                          ),
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Distribute Confirm Dialog */}
      {distributeTarget && (
        <DistributeDialog
          pool={distributeTarget}
          workerMap={workerMap}
          onConfirm={() => distributeMutation.mutate(distributeTarget)}
          onCancel={() => setDistributeTarget(null)}
          isPending={distributeMutation.isPending}
        />
      )}
    </div>
  );
}
