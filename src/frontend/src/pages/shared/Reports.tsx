import { Layout } from "@/components/layout/Layout";
import { PriorityBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBackendActor } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { JobPriority, JobStatus, WorkerStatus } from "../../backend";
import type {
  AttendanceRecord,
  IncentiveLedgerEntry,
  Job,
  Worker,
} from "../../types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: bigint): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function tsInRange(ts: bigint, from: string, to: string): boolean {
  const ms = Number(ts) / 1_000_000;
  const fromMs = from ? new Date(from).getTime() : 0;
  const toMs = to
    ? new Date(`${to}T23:59:59`).getTime()
    : Number.POSITIVE_INFINITY;
  return ms >= fromMs && ms <= toMs;
}

function downloadCSV(filename: string, rows: string[][]): void {
  const content = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildWorkerMap(workers: Worker[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const w of workers) {
    m[String(w.id)] = w.name;
  }
  return m;
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

interface DateRangeProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function DateRangeFilter({ from, to, onChange }: DateRangeProps) {
  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="w-40 h-8 text-sm"
          data-ocid="reports.filter.from_date"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="w-40 h-8 text-sm"
          data-ocid="reports.filter.to_date"
        />
      </div>
    </div>
  );
}

// ── Export Buttons ────────────────────────────────────────────────────────────

interface ExportActionsProps {
  onCSV: () => void;
  onPDF: () => void;
}

function ExportActions({ onCSV, onPDF }: ExportActionsProps) {
  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={onCSV}
        data-ocid="reports.export_csv_button"
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onPDF}
        data-ocid="reports.export_pdf_button"
        className="gap-1.5"
      >
        <Printer className="h-3.5 w-3.5" />
        Export PDF
      </Button>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function TableSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <div className="space-y-2" data-ocid="reports.loading_state">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton cols
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Jobs Report ───────────────────────────────────────────────────────────────

interface JobsReportProps {
  jobs: Job[];
  workers: Worker[];
  from: string;
  to: string;
}

function JobsReport({ jobs, workers, from, to }: JobsReportProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [workerFilter, setWorkerFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (!tsInRange(j.createdAt, from, to)) return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (priorityFilter !== "all" && j.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [jobs, from, to, statusFilter, priorityFilter]);

  function handleCSV() {
    const headers = [
      "Job ID",
      "Customer",
      "Car",
      "Status",
      "Priority",
      "Estimated Hours",
      "Created",
    ];
    const rows = filtered.map((j) => [
      j.jobId,
      j.customerName,
      `${j.carMake} ${j.carModel} (${j.carYear})`,
      j.status,
      j.priority,
      String(j.estimatedHours),
      formatDate(j.createdAt),
    ]);
    downloadCSV(`jobs-report-${today()}.csv`, [headers, ...rows]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter from={from} to={to} onChange={() => {}} />
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="jobs-status-filter"
              className="text-xs text-muted-foreground"
            >
              Status
            </Label>
            <select
              id="jobs-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-ocid="reports.jobs.status_filter"
            >
              <option value="all">All Statuses</option>
              {Object.values(JobStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="jobs-priority-filter"
              className="text-xs text-muted-foreground"
            >
              Priority
            </Label>
            <select
              id="jobs-priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-ocid="reports.jobs.priority_filter"
            >
              <option value="all">All Priorities</option>
              {Object.values(JobPriority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="jobs-worker-filter"
              className="text-xs text-muted-foreground"
            >
              Worker
            </Label>
            <select
              id="jobs-worker-filter"
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              data-ocid="reports.jobs.worker_filter"
            >
              <option value="all">All Workers</option>
              {workers.map((w) => (
                <option key={String(w.id)} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ExportActions onCSV={handleCSV} onPDF={() => window.print()} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-foreground">
                Job ID
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Customer
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Car
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Status
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Priority
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Est. Hours
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Created
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12 text-muted-foreground"
                  data-ocid="reports.jobs.empty_state"
                >
                  No jobs match the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((job, i) => (
                <TableRow
                  key={job.jobId}
                  data-ocid={`reports.jobs.item.${i + 1}`}
                >
                  <TableCell className="font-mono text-xs font-medium text-primary">
                    {job.jobId}
                  </TableCell>
                  <TableCell>{job.customerName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {job.carMake} {job.carModel}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={job.priority} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {String(job.estimatedHours)}h
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(job.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} record(s)
      </p>
    </div>
  );
}

// ── Workers Report ────────────────────────────────────────────────────────────

interface WorkerRow {
  worker: Worker;
  totalIncentive: bigint;
  daysPresent: number;
  totalDays: number;
}

interface WorkersReportProps {
  workers: Worker[];
  ledger: IncentiveLedgerEntry[];
  attendance: AttendanceRecord[];
}

function WorkersReport({ workers, ledger, attendance }: WorkersReportProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const rows: WorkerRow[] = useMemo(() => {
    return workers
      .filter((w) => statusFilter === "all" || w.status === statusFilter)
      .map((w) => {
        const wLedger = ledger.filter((l) => l.workerId === w.id);
        const wAttendance = attendance.filter((a) => a.workerId === w.id);
        const present = wAttendance.filter((a) => !a.isAbsent).length;
        return {
          worker: w,
          totalIncentive: wLedger.reduce((sum, l) => sum + l.amount, 0n),
          daysPresent: present,
          totalDays: wAttendance.length,
        };
      });
  }, [workers, ledger, attendance, statusFilter]);

  function handleCSV() {
    const headers = [
      "Worker Name",
      "Status",
      "Total Incentive (₹)",
      "Days Present",
      "Attendance %",
    ];
    const csvRows = rows.map((r) => [
      r.worker.name,
      r.worker.status,
      String(r.totalIncentive),
      String(r.daysPresent),
      r.totalDays > 0
        ? `${Math.round((r.daysPresent / r.totalDays) * 100)}%`
        : "N/A",
    ]);
    downloadCSV(`workers-report-${today()}.csv`, [headers, ...csvRows]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="workers-status-filter"
            className="text-xs text-muted-foreground"
          >
            Status
          </Label>
          <select
            id="workers-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            data-ocid="reports.workers.status_filter"
          >
            <option value="all">All</option>
            {Object.values(WorkerStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <ExportActions onCSV={handleCSV} onPDF={() => window.print()} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-foreground">
                Worker Name
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Status
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Total Incentive
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Days Present
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Attendance %
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                  data-ocid="reports.workers.empty_state"
                >
                  No workers found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => {
                const attendancePct =
                  row.totalDays > 0
                    ? Math.round((row.daysPresent / row.totalDays) * 100)
                    : null;
                return (
                  <TableRow
                    key={String(row.worker.id)}
                    data-ocid={`reports.workers.item.${i + 1}`}
                  >
                    <TableCell className="font-medium">
                      {row.worker.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md border ${
                          row.worker.status === WorkerStatus.active
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {row.worker.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.totalIncentive)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.daysPresent}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {attendancePct !== null ? (
                        `${attendancePct}%`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} worker(s)</p>
    </div>
  );
}

// ── Incentive Ledger ──────────────────────────────────────────────────────────

interface IncentiveLedgerProps {
  ledger: IncentiveLedgerEntry[];
  workers: Worker[];
  from: string;
  to: string;
}

function IncentiveLedger({ ledger, workers, from, to }: IncentiveLedgerProps) {
  const [workerFilter, setWorkerFilter] = useState<string>("all");

  const workerMap = useMemo(() => buildWorkerMap(workers), [workers]);

  const filtered = useMemo(() => {
    return ledger.filter((e) => {
      if (!tsInRange(e.distributedAt, from, to)) return false;
      if (workerFilter !== "all" && String(e.workerId) !== workerFilter)
        return false;
      return true;
    });
  }, [ledger, from, to, workerFilter]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0n);

  function handleCSV() {
    const headers = [
      "Worker Name",
      "Worker ID",
      "Job ID",
      "Amount (₹)",
      "Early Bonus",
      "Distributed At",
    ];
    const rows = filtered.map((e) => [
      workerMap[String(e.workerId)] ?? String(e.workerId),
      String(e.workerId),
      e.jobId,
      String(e.amount),
      e.earlyBonus ? "Yes" : "No",
      formatDate(e.distributedAt),
    ]);
    downloadCSV(`incentive-ledger-${today()}.csv`, [headers, ...rows]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="incentive-worker-filter"
            className="text-xs text-muted-foreground"
          >
            Worker
          </Label>
          <select
            id="incentive-worker-filter"
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            data-ocid="reports.incentive.worker_filter"
          >
            <option value="all">All Workers</option>
            {workers.map((w) => (
              <option key={String(w.id)} value={String(w.id)}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <ExportActions onCSV={handleCSV} onPDF={() => window.print()} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-foreground">
                Worker
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Job ID
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Amount
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center">
                Early Bonus
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Distributed At
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-12 text-muted-foreground"
                  data-ocid="reports.incentive.empty_state"
                >
                  No incentive records in this period.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry, i) => (
                <TableRow
                  key={`${entry.workerId}-${entry.jobId}-${i}`}
                  data-ocid={`reports.incentive.item.${i + 1}`}
                >
                  <TableCell className="font-medium">
                    {workerMap[String(entry.workerId)] ??
                      `Worker #${entry.workerId}`}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">
                    {entry.jobId}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.earlyBonus ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Yes
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(entry.distributedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
            {filtered.length > 0 && (
              <TableRow className="bg-muted/20 font-semibold">
                <TableCell colSpan={2} className="text-right text-sm">
                  Total Payable
                </TableCell>
                <TableCell className="text-right tabular-nums text-primary font-bold">
                  {formatCurrency(totalAmount)}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} entries · Payroll total: {formatCurrency(totalAmount)}
      </p>
    </div>
  );
}

// ── Attendance Report ─────────────────────────────────────────────────────────

interface AttendanceReportProps {
  attendance: AttendanceRecord[];
  workers: Worker[];
  from: string;
  to: string;
}

interface AttendanceWorkerRow {
  workerId: bigint;
  workerName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

function AttendanceReport({
  attendance,
  workers,
  from,
  to,
}: AttendanceReportProps) {
  const workerMap = useMemo(() => buildWorkerMap(workers), [workers]);

  const rows: AttendanceWorkerRow[] = useMemo(() => {
    const filtered = attendance.filter((a) => {
      if (from && a.date < from) return false;
      if (to && a.date > to) return false;
      return true;
    });

    const grouped: Record<string, AttendanceRecord[]> = {};
    for (const a of filtered) {
      const key = String(a.workerId);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    }

    return Object.entries(grouped).map(([id, records]) => ({
      workerId: BigInt(id),
      workerName: workerMap[id] ?? `Worker #${id}`,
      present: records.filter((r) => !r.isAbsent).length,
      absent: records.filter((r) => r.isAbsent).length,
      late: records.filter((r) => r.isLate).length,
      total: records.length,
    }));
  }, [attendance, from, to, workerMap]);

  function handleCSV() {
    const headers = [
      "Worker",
      "Days Present",
      "Days Absent",
      "Days Late",
      "Total Days",
      "Attendance %",
    ];
    const csvRows = rows.map((r) => [
      r.workerName,
      String(r.present),
      String(r.absent),
      String(r.late),
      String(r.total),
      r.total > 0 ? `${Math.round((r.present / r.total) * 100)}%` : "N/A",
    ]);
    downloadCSV(`attendance-report-${today()}.csv`, [headers, ...csvRows]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="text-sm text-muted-foreground">
          {from && to ? `Showing ${from} to ${to}` : "All dates"}
        </div>
        <ExportActions onCSV={handleCSV} onPDF={() => window.print()} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-foreground">
                Worker
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Present
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Absent
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Late
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Total Days
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                Attendance %
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                  data-ocid="reports.attendance.empty_state"
                >
                  No attendance records for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => {
                const pct =
                  row.total > 0
                    ? Math.round((row.present / row.total) * 100)
                    : null;
                const pctColor =
                  pct === null
                    ? ""
                    : pct >= 90
                      ? "text-emerald-700 font-semibold"
                      : pct >= 75
                        ? "text-amber-700 font-semibold"
                        : "text-red-700 font-semibold";
                return (
                  <TableRow
                    key={String(row.workerId)}
                    data-ocid={`reports.attendance.item.${i + 1}`}
                  >
                    <TableCell className="font-medium">
                      {row.workerName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">
                      {row.present}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-600">
                      {row.absent}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-700">
                      {row.late}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.total}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${pctColor}`}
                    >
                      {pct !== null ? `${pct}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{rows.length} worker(s)</p>
    </div>
  );
}

// ── Daily Summary ─────────────────────────────────────────────────────────────

interface DailySummaryProps {
  jobs: Job[];
  ledger: IncentiveLedgerEntry[];
  attendance: AttendanceRecord[];
  workers: Worker[];
  date: string;
  onDateChange: (d: string) => void;
}

function DailySummary({
  jobs,
  ledger,
  attendance,
  workers,
  date,
  onDateChange,
}: DailySummaryProps) {
  const dayStart = useMemo(() => new Date(date).getTime(), [date]);
  const dayEnd = useMemo(() => new Date(`${date}T23:59:59`).getTime(), [date]);

  const completedToday = useMemo(
    () =>
      jobs.filter((j) => {
        if (j.status !== JobStatus.completed) return false;
        const ts = Number(j.createdAt) / 1_000_000;
        return ts >= dayStart && ts <= dayEnd;
      }),
    [jobs, dayStart, dayEnd],
  );

  const incentivesToday = useMemo(
    () =>
      ledger.filter((e) => {
        const ts = Number(e.distributedAt) / 1_000_000;
        return ts >= dayStart && ts <= dayEnd;
      }),
    [ledger, dayStart, dayEnd],
  );

  const totalIncentive = incentivesToday.reduce((s, e) => s + e.amount, 0n);

  const attendanceToday = useMemo(
    () => attendance.filter((a) => a.date === date),
    [attendance, date],
  );

  const presentToday = attendanceToday.filter((a) => !a.isAbsent).length;
  const absentToday = attendanceToday.filter((a) => a.isAbsent).length;
  const lateToday = attendanceToday.filter((a) => a.isLate).length;

  const workerMap = useMemo(() => buildWorkerMap(workers), [workers]);

  const summaryStats = [
    {
      label: "Jobs Completed",
      value: completedToday.length,
      color: "text-emerald-700",
    },
    {
      label: "Incentives Paid",
      value: formatCurrency(totalIncentive),
      color: "text-primary",
    },
    { label: "Present", value: presentToday, color: "text-emerald-700" },
    { label: "Absent", value: absentToday, color: "text-red-600" },
    { label: "Late Arrivals", value: lateToday, color: "text-amber-700" },
  ];

  function handleCSV() {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Date", date],
      ["Jobs Completed", String(completedToday.length)],
      ["Incentives Paid (₹)", String(totalIncentive)],
      ["Workers Present", String(presentToday)],
      ["Workers Absent", String(absentToday)],
      ["Workers Late", String(lateToday)],
    ];
    downloadCSV(`daily-summary-${date}.csv`, [headers, ...rows]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="daily-date-picker"
            className="text-xs text-muted-foreground"
          >
            Date
          </Label>
          <Input
            id="daily-date-picker"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-44 h-8 text-sm"
            data-ocid="reports.daily.date_picker"
          />
        </div>
        <ExportActions onCSV={handleCSV} onPDF={() => window.print()} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summaryStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold font-display ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Completed Jobs Table */}
      {completedToday.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Jobs Completed Today
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-foreground">
                    Job ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Car
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Priority
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedToday.map((job, i) => (
                  <TableRow
                    key={job.jobId}
                    data-ocid={`reports.daily.completed.item.${i + 1}`}
                  >
                    <TableCell className="font-mono text-xs text-primary">
                      {job.jobId}
                    </TableCell>
                    <TableCell>{job.customerName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {job.carMake} {job.carModel}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={job.priority} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Attendance Today */}
      {attendanceToday.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Attendance Today
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold text-foreground">
                    Worker
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-center">
                    Present
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-center">
                    Late
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Check In
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Check Out
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceToday.map((rec, i) => (
                  <TableRow
                    key={String(rec.id)}
                    data-ocid={`reports.daily.attendance.item.${i + 1}`}
                  >
                    <TableCell className="font-medium">
                      {workerMap[String(rec.workerId)] ??
                        `Worker #${rec.workerId}`}
                    </TableCell>
                    <TableCell className="text-center">
                      {!rec.isAbsent ? (
                        <span className="text-emerald-700 font-semibold text-sm">
                          ✓
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold text-sm">
                          ✗
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {rec.isLate ? (
                        <span className="text-amber-700 text-xs font-semibold">
                          Late
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rec.checkInAt ? formatDate(rec.checkInAt) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rec.checkOutAt ? formatDate(rec.checkOutAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Reports Page ─────────────────────────────────────────────────────────

export default function Reports() {
  const { actor, isFetching } = useBackendActor();

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today);
  const [dailyDate, setDailyDate] = useState(today);
  const [activeTab, setActiveTab] = useState("jobs");

  const enabled = !!actor && !isFetching;

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["reports-jobs"],
    queryFn: async () => (actor ? actor.listAllJobs() : []),
    enabled,
    staleTime: 60_000,
  });

  const { data: workers = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["reports-workers"],
    queryFn: async () => (actor ? actor.listWorkers(null) : []),
    enabled,
    staleTime: 60_000,
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery<
    IncentiveLedgerEntry[]
  >({
    queryKey: ["reports-ledger"],
    queryFn: async () => (actor ? actor.getAllIncentiveLedger() : []),
    enabled,
    staleTime: 60_000,
  });

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery<
    AttendanceRecord[]
  >({
    queryKey: ["reports-attendance", fromDate, toDate],
    queryFn: async () =>
      actor
        ? actor.queryAttendance({
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          })
        : [],
    enabled,
    staleTime: 60_000,
  });

  const tabLoading: Record<string, boolean> = {
    jobs: jobsLoading || workersLoading,
    workers: workersLoading || ledgerLoading || attendanceLoading,
    incentive: ledgerLoading || workersLoading,
    attendance: attendanceLoading || workersLoading,
    daily: jobsLoading || ledgerLoading || attendanceLoading || workersLoading,
  };

  return (
    <Layout>
      {/* Print header — only visible when printing */}
      <div className="hidden print:block mb-6">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Workshop Management System
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Reports Export · Generated: {new Date().toLocaleString("en-IN")}
            </p>
          </div>
          <div className="text-sm text-right text-muted-foreground">
            <p>
              Period: {fromDate || "All"} — {toDate || "All"}
            </p>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="mb-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Reports
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Filterable reports with CSV and PDF export
            </p>
          </div>
          <DateRangeFilter
            from={fromDate}
            to={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 print:hidden" data-ocid="reports.tabs">
          <TabsTrigger value="jobs" data-ocid="reports.tab.jobs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="workers" data-ocid="reports.tab.workers">
            Workers
          </TabsTrigger>
          <TabsTrigger value="incentive" data-ocid="reports.tab.incentive">
            Incentive Ledger
          </TabsTrigger>
          <TabsTrigger value="attendance" data-ocid="reports.tab.attendance">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="daily" data-ocid="reports.tab.daily">
            Daily Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" data-ocid="reports.jobs.panel">
          {tabLoading.jobs ? (
            <TableSkeleton cols={7} />
          ) : (
            <JobsReport
              jobs={jobs}
              workers={workers}
              from={fromDate}
              to={toDate}
            />
          )}
        </TabsContent>

        <TabsContent value="workers" data-ocid="reports.workers.panel">
          {tabLoading.workers ? (
            <TableSkeleton cols={5} />
          ) : (
            <WorkersReport
              workers={workers}
              ledger={ledger}
              attendance={attendance}
            />
          )}
        </TabsContent>

        <TabsContent value="incentive" data-ocid="reports.incentive.panel">
          {tabLoading.incentive ? (
            <TableSkeleton cols={5} />
          ) : (
            <IncentiveLedger
              ledger={ledger}
              workers={workers}
              from={fromDate}
              to={toDate}
            />
          )}
        </TabsContent>

        <TabsContent value="attendance" data-ocid="reports.attendance.panel">
          {tabLoading.attendance ? (
            <TableSkeleton cols={6} />
          ) : (
            <AttendanceReport
              attendance={attendance}
              workers={workers}
              from={fromDate}
              to={toDate}
            />
          )}
        </TabsContent>

        <TabsContent value="daily" data-ocid="reports.daily.panel">
          {tabLoading.daily ? (
            <TableSkeleton cols={4} />
          ) : (
            <DailySummary
              jobs={jobs}
              ledger={ledger}
              attendance={attendance}
              workers={workers}
              date={dailyDate}
              onDateChange={setDailyDate}
            />
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
