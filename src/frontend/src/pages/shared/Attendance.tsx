import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  MapPin,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BiometricEvent } from "../../backend";
import type {
  AttendanceRecord,
  BiometricRawRecord,
  Worker,
  WorkerId,
} from "../../backend.d.ts";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatTime(ts: bigint) {
  return new Date(Number(ts / 1_000_000n)).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hoursPresent(checkIn?: bigint, checkOut?: bigint): string {
  if (!checkIn || !checkOut) return "—";
  const diffMs = Number((checkOut - checkIn) / 1_000_000n);
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function monthStr(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

// ─── CSV parsing ─────────────────────────────────────────────────────────────

interface ParsedRow {
  employeeId: string;
  timestamp: string;
  event: string;
  valid: boolean;
  error?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const [employeeId, timestamp, event] = parts;
    if (!employeeId && !timestamp && !event) continue;

    let error: string | undefined;
    if (!employeeId) error = "Missing Employee_ID";
    else if (!timestamp) error = "Missing Timestamp";
    else if (Number.isNaN(Date.parse(timestamp))) error = "Invalid Timestamp";
    else if (!event) error = "Missing Event";
    else if (event !== "CheckIn" && event !== "CheckOut")
      error = "Event must be CheckIn or CheckOut";

    rows.push({ employeeId, timestamp, event, valid: !error, error });
  }
  return rows;
}

function toBiometricRaw(row: ParsedRow): BiometricRawRecord {
  const ms = BigInt(new Date(row.timestamp).getTime()) * 1_000_000n;
  return {
    biometricEmployeeId: row.employeeId,
    event:
      row.event === "CheckIn"
        ? BiometricEvent.checkIn
        : BiometricEvent.checkOut,
    eventTimestamp: ms,
  };
}

// ─── export CSV ──────────────────────────────────────────────────────────────

function exportToCSV(records: AttendanceRecord[], workers: Worker[]) {
  const workerMap = new Map(workers.map((w) => [w.id.toString(), w.name]));
  const header = "Worker,Biometric ID,Date,Check In,Check Out,Hours,Status\n";
  const body = records
    .map((r) => {
      const name = workerMap.get(r.workerId.toString()) ?? `#${r.workerId}`;
      const checkIn = r.checkInAt ? formatTime(r.checkInAt) : "";
      const checkOut = r.checkOutAt ? formatTime(r.checkOutAt) : "";
      const hours = hoursPresent(r.checkInAt, r.checkOutAt);
      const status = r.isAbsent ? "Absent" : r.isLate ? "Late" : "Present";
      return `"${name}","${r.biometricEmployeeId}","${r.date}","${checkIn}","${checkOut}","${hours}","${status}"`;
    })
    .join("\n");

  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-export-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── sub-components ──────────────────────────────────────────────────────────

interface AnomalyBadgeProps {
  isAbsent: boolean;
  isLate: boolean;
}
function AnomalyBadge({ isAbsent, isLate }: AnomalyBadgeProps) {
  if (isAbsent)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700 border border-red-200">
        Absent
      </span>
    );
  if (isLate)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700 border border-amber-200">
        Late
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
      Present
    </span>
  );
}

// ─── Daily View ──────────────────────────────────────────────────────────────

interface DailyViewProps {
  records: AttendanceRecord[];
  workers: Worker[];
  isLoading: boolean;
}

function DailyView({ records, workers, isLoading }: DailyViewProps) {
  const workerMap = new Map(workers.map((w) => [w.id.toString(), w.name]));

  if (isLoading)
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded" />
        ))}
      </div>
    );

  if (records.length === 0)
    return (
      <div
        data-ocid="attendance.daily.empty_state"
        className="text-center py-12"
      >
        <Users size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No records for this date
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Import CSV data to populate attendance
        </p>
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Worker
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Biometric ID
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Check In
            </th>
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Check Out
            </th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Hours Present
            </th>
            <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => (
            <tr
              key={rec.id.toString()}
              data-ocid={`attendance.daily.item.${i + 1}`}
              className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                rec.isAbsent
                  ? "bg-red-50/50"
                  : rec.isLate
                    ? "bg-amber-50/50"
                    : ""
              }`}
            >
              <td className="py-3 px-4 font-medium text-foreground">
                {workerMap.get(rec.workerId.toString()) ?? (
                  <span className="font-mono text-xs text-muted-foreground">
                    #{rec.workerId.toString()}
                  </span>
                )}
              </td>
              <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                {rec.biometricEmployeeId}
              </td>
              <td className="py-3 px-4 text-sm tabular-nums">
                {rec.checkInAt ? formatTime(rec.checkInAt) : "—"}
              </td>
              <td className="py-3 px-4 text-sm tabular-nums">
                {rec.checkOutAt ? formatTime(rec.checkOutAt) : "—"}
              </td>
              <td className="py-3 px-4 text-sm tabular-nums text-right">
                {hoursPresent(rec.checkInAt, rec.checkOutAt)}
              </td>
              <td className="py-3 px-4 text-center">
                <AnomalyBadge isAbsent={rec.isAbsent} isLate={rec.isLate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Monthly View ─────────────────────────────────────────────────────────────

interface MonthlyViewProps {
  actor: import("../../backend.d.ts").backendInterface | null;
  isFetchingActor: boolean;
  workers: Worker[];
}

function MonthlyView({ actor, isFetchingActor, workers }: MonthlyViewProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);
  const currentMonth = monthStr(year, month);

  // Fetch all records for the month
  const firstDate = `${currentMonth}-01`;
  const lastDate = `${currentMonth}-${String(totalDays).padStart(2, "0")}`;

  const { data: monthRecords = [], isLoading: isMonthLoading } = useQuery({
    queryKey: ["attendance-month", currentMonth],
    queryFn: () =>
      actor!.queryAttendance({ fromDate: firstDate, toDate: lastDate }),
    enabled: !!actor && !isFetchingActor,
  });

  // Fetch monthly summaries per worker
  const { data: summaries = [], isLoading: isSummaryLoading } = useQuery({
    queryKey: ["attendance-summaries", currentMonth],
    queryFn: async () => {
      if (!actor) return [];
      const results = await Promise.all(
        workers.map((w) =>
          actor.getMonthlyAttendanceSummary(w.id, currentMonth),
        ),
      );
      return results;
    },
    enabled: !!actor && !isFetchingActor && workers.length > 0,
  });

  // Build day → record count map
  const dayMap = new Map<
    string,
    { late: number; absent: number; present: number }
  >();
  for (const rec of monthRecords) {
    const key = rec.date;
    const existing = dayMap.get(key) ?? { late: 0, absent: 0, present: 0 };
    if (rec.isAbsent) existing.absent++;
    else if (rec.isLate) existing.late++;
    else existing.present++;
    dayMap.set(key, existing);
  }

  const selectedDayRecords = selectedDay
    ? monthRecords.filter((r) => r.date === selectedDay)
    : [];

  const workerMap = new Map(workers.map((w) => [w.id.toString(), w.name]));
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6 p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground font-display">
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            data-ocid="attendance.monthly.prev_month"
            onClick={prevMonth}
            className="h-8 w-8"
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            data-ocid="attendance.monthly.next_month"
            onClick={nextMonth}
            className="h-8 w-8"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      {isMonthLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {[
            "s0",
            "s1",
            "s2",
            "s3",
            "s4",
            "s5",
            "s6",
            "s7",
            "s8",
            "s9",
            "s10",
            "s11",
            "s12",
            "s13",
            "s14",
            "s15",
            "s16",
            "s17",
            "s18",
            "s19",
            "s20",
            "s21",
            "s22",
            "s23",
            "s24",
            "s25",
            "s26",
            "s27",
            "s28",
            "s29",
            "s30",
            "s31",
            "s32",
            "s33",
            "s34",
          ].map((k) => (
            <Skeleton key={k} className="h-14 rounded" />
          ))}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Day header */}
          <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
            {dayNames.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }, (_, i) => (
              <div
                key={`${currentMonth}-empty-${7 - firstDay + i}`}
                className="h-14 bg-muted/20 border-b border-r border-border"
              />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
              const data = dayMap.get(dateStr);
              const isSelected = selectedDay === dateStr;
              const isToday = dateStr === todayStr();

              return (
                <button
                  type="button"
                  key={dateStr}
                  data-ocid={`attendance.monthly.day.${day}`}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={`h-14 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-muted/40 ${
                    isSelected
                      ? "bg-primary/10 ring-1 ring-inset ring-primary"
                      : ""
                  } ${isToday ? "bg-blue-50/60" : ""}`}
                >
                  <span
                    className={`text-xs font-medium block mb-1 ${
                      isToday ? "text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  {data && (
                    <div className="flex flex-wrap gap-0.5">
                      {data.absent > 0 && (
                        <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                          {data.absent}A
                        </span>
                      )}
                      {data.late > 0 && (
                        <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">
                          {data.late}L
                        </span>
                      )}
                      {data.present > 0 && (
                        <span className="text-[9px] leading-none px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                          {data.present}P
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day breakdown */}
      {selectedDay && (
        <Card className="border border-border">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(
                  "en-GB",
                  { weekday: "long", day: "numeric", month: "long" },
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSelectedDay(null)}
              >
                <X size={12} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {selectedDayRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No records for this day
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayRecords.map((rec) => (
                  <div
                    key={rec.id.toString()}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {workerMap.get(rec.workerId.toString()) ??
                          `#${rec.workerId}`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {rec.biometricEmployeeId}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs tabular-nums">
                        {rec.checkInAt ? formatTime(rec.checkInAt) : "—"} →{" "}
                        {rec.checkOutAt ? formatTime(rec.checkOutAt) : "—"}
                      </p>
                      <AnomalyBadge
                        isAbsent={rec.isAbsent}
                        isLate={rec.isLate}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly summary table */}
      <Card className="border border-border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold">
            Worker Attendance Summary — {monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isSummaryLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No summary data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Worker
                    </th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Present
                    </th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Late
                    </th>
                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Absent
                    </th>
                    <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Attendance %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s, i) => {
                    const total =
                      Number(s.daysPresent) +
                      Number(s.daysAbsent) +
                      Number(s.daysLate);
                    const pct =
                      total > 0
                        ? Math.round(
                            ((Number(s.daysPresent) + Number(s.daysLate)) /
                              total) *
                              100,
                          )
                        : 0;
                    return (
                      <tr
                        key={`${s.workerId}-${i}`}
                        data-ocid={`attendance.summary.item.${i + 1}`}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <td className="py-2.5 px-4 font-medium">
                          {workerMap.get(s.workerId.toString()) ??
                            `#${s.workerId}`}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-700 font-semibold tabular-nums">
                          {Number(s.daysPresent)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-700 font-semibold tabular-nums">
                          {Number(s.daysLate)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-red-700 font-semibold tabular-nums">
                          {Number(s.daysAbsent)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-muted rounded-full h-1.5 hidden sm:block">
                              <div
                                className={`h-1.5 rounded-full ${
                                  pct >= 90
                                    ? "bg-emerald-500"
                                    : pct >= 75
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                pct >= 90
                                  ? "text-emerald-700"
                                  : pct >= 75
                                    ? "text-amber-700"
                                    : "text-red-700"
                              }`}
                            >
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

interface CsvImportProps {
  actor: import("../../backend.d.ts").backendInterface | null;
  isFetchingActor: boolean;
}

function CsvImport({ actor, isFetchingActor }: CsvImportProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [filename, setFilename] = useState("");

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const validRows = rows.filter((r) => r.valid);
      const batchId = `batch-${Date.now()}`;
      const count = await actor.importAttendance({
        records: validRows.map(toBiometricRaw),
        batchId,
      });
      return count;
    },
    onSuccess: (count) => {
      toast.success(`Imported ${count} attendance records`);
      setRows([]);
      setFilename("");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-month"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-summaries"] });
    },
    onError: () => toast.error("Import failed. Please try again."),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file);
  }

  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.filter((r) => !r.valid).length;

  return (
    <div className="space-y-6 p-4">
      {/* Format info */}
      <Card className="bg-blue-50/60 border border-blue-200">
        <CardContent className="p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            Expected CSV Format
          </h4>
          <div className="overflow-x-auto">
            <table className="text-xs text-blue-800 w-full">
              <thead>
                <tr className="border-b border-blue-200">
                  {["Column", "Name", "Format / Values"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-1.5 pr-6 font-semibold uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {[
                  ["1", "Employee_ID", "Alphanumeric, e.g. EMP001"],
                  ["2", "Timestamp", "ISO 8601, e.g. 2026-04-25T09:00:00"],
                  ["3", "Event", "CheckIn or CheckOut"],
                ].map(([col, name, fmt]) => (
                  <tr
                    key={col}
                    className="border-b border-blue-100 last:border-0"
                  >
                    <td className="py-1.5 pr-6">{col}</td>
                    <td className="py-1.5 pr-6 font-bold">{name}</td>
                    <td className="py-1.5 text-blue-600">{fmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            First row must be the header:{" "}
            <code className="bg-blue-100 px-1 rounded">
              Employee_ID,Timestamp,Event
            </code>
          </p>
        </CardContent>
      </Card>

      {/* Upload area */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Select CSV File
        </Label>
        <button
          type="button"
          className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          aria-label="Upload CSV file"
          data-ocid="attendance.import.dropzone"
        >
          <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
          {filename ? (
            <p className="text-sm font-medium text-foreground">{filename}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click to browse or drop your CSV file here
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFile}
            data-ocid="attendance.import.upload_button"
          />
        </button>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              Preview ({rows.length} rows)
            </h4>
            <div className="flex items-center gap-2">
              {validCount > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
                  {validCount} valid
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
                  {errorCount} errors
                </Badge>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60 border-b border-border">
                  <tr>
                    {["#", "Employee ID", "Timestamp", "Event", "Status"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={`${row.employeeId}-${row.timestamp}-${i}`}
                      data-ocid={`attendance.import.preview.item.${i + 1}`}
                      className={`border-b border-border last:border-0 ${
                        !row.valid ? "bg-red-50/60" : ""
                      }`}
                    >
                      <td className="py-2 px-3 text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="py-2 px-3 font-mono">{row.employeeId}</td>
                      <td className="py-2 px-3 font-mono">{row.timestamp}</td>
                      <td className="py-2 px-3">{row.event}</td>
                      <td className="py-2 px-3">
                        {row.valid ? (
                          <span className="text-emerald-700 font-medium">
                            ✓
                          </span>
                        ) : (
                          <span className="text-red-600 font-medium flex items-center gap-1">
                            <AlertTriangle size={10} />
                            {row.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              data-ocid="attendance.import.confirm_button"
              onClick={() => importMutation.mutate()}
              disabled={
                validCount === 0 ||
                importMutation.isPending ||
                !actor ||
                isFetchingActor
              }
              className="min-w-32"
            >
              {importMutation.isPending
                ? "Importing…"
                : `Import ${validCount} Records`}
            </Button>
            <Button
              variant="outline"
              data-ocid="attendance.import.cancel_button"
              onClick={() => {
                setRows([]);
                setFilename("");
              }}
            >
              Clear
            </Button>
            {errorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {errorCount} row{errorCount > 1 ? "s" : ""} with errors will be
                skipped
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Biometric Mapping ────────────────────────────────────────────────────────

interface BiometricMappingProps {
  actor: import("../../backend.d.ts").backendInterface | null;
  isFetchingActor: boolean;
  workers: Worker[];
}

function BiometricMapping({
  actor,
  isFetchingActor,
  workers,
}: BiometricMappingProps) {
  const queryClient = useQueryClient();
  const [newBioId, setNewBioId] = useState("");
  const [newWorkerId, setNewWorkerId] = useState<string>("");
  const [editingBioId, setEditingBioId] = useState<string | null>(null);
  const [editWorkerId, setEditWorkerId] = useState<string>("");

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["biometric-mappings"],
    queryFn: () => actor!.listBiometricMappings(),
    enabled: !!actor && !isFetchingActor,
  });

  const setMappingMutation = useMutation({
    mutationFn: async ({
      bioId,
      wId,
    }: {
      bioId: string;
      wId: WorkerId;
    }) => actor!.setBiometricMapping(bioId, wId),
    onSuccess: () => {
      toast.success("Biometric mapping saved");
      queryClient.invalidateQueries({ queryKey: ["biometric-mappings"] });
      setNewBioId("");
      setNewWorkerId("");
      setEditingBioId(null);
    },
    onError: () => toast.error("Failed to save mapping"),
  });

  const workerOptions = workers.filter((w) => w.status.toString() === "active");

  function handleAdd() {
    if (!newBioId.trim() || !newWorkerId) return;
    setMappingMutation.mutate({
      bioId: newBioId.trim(),
      wId: BigInt(newWorkerId),
    });
  }

  function handleEdit(bioId: string, currentWorkerId: WorkerId) {
    setEditingBioId(bioId);
    setEditWorkerId(currentWorkerId.toString());
  }

  function handleSaveEdit(bioId: string) {
    if (!editWorkerId) return;
    setMappingMutation.mutate({ bioId, wId: BigInt(editWorkerId) });
  }

  const workerMap = new Map(workers.map((w) => [w.id.toString(), w.name]));

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-start gap-3 p-3 bg-amber-50/60 border border-amber-200 rounded-lg">
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800">
          Biometric Employee IDs from CSV imports must be mapped to worker
          profiles before attendance records can be linked. Unmapped records
          will still be imported but won't appear under a worker name.
        </p>
      </div>

      {/* Add new mapping */}
      <Card className="border border-border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Link2 size={14} />
            Add Mapping
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Biometric Employee ID</Label>
              <Input
                placeholder="e.g. EMP001"
                value={newBioId}
                onChange={(e) => setNewBioId(e.target.value)}
                data-ocid="attendance.mapping.bio_id.input"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Worker</Label>
              <select
                value={newWorkerId}
                onChange={(e) => setNewWorkerId(e.target.value)}
                data-ocid="attendance.mapping.worker.select"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select worker…</option>
                {workerOptions.map((w) => (
                  <option key={w.id.toString()} value={w.id.toString()}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleAdd}
              disabled={
                !newBioId.trim() || !newWorkerId || setMappingMutation.isPending
              }
              data-ocid="attendance.mapping.add_button"
            >
              Add Mapping
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing mappings */}
      <Card className="border border-border">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin size={14} />
            Existing Mappings ({mappings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : mappings.length === 0 ? (
            <div
              data-ocid="attendance.mapping.empty_state"
              className="text-center py-8"
            >
              <Link2 size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No biometric mappings configured
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Biometric ID
                  </th>
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Worker
                  </th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map(([bioId, wId], i) => (
                  <tr
                    key={bioId}
                    data-ocid={`attendance.mapping.item.${i + 1}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="py-3 px-4 font-mono text-sm">{bioId}</td>
                    <td className="py-3 px-4">
                      {editingBioId === bioId ? (
                        <select
                          value={editWorkerId}
                          onChange={(e) => setEditWorkerId(e.target.value)}
                          className="h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          data-ocid={`attendance.mapping.edit_select.${i + 1}`}
                        >
                          {workerOptions.map((w) => (
                            <option
                              key={w.id.toString()}
                              value={w.id.toString()}
                            >
                              {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>
                          {workerMap.get(wId.toString()) ?? (
                            <span className="text-muted-foreground font-mono text-xs">
                              #{wId.toString()}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingBioId === bioId ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(bioId)}
                            disabled={setMappingMutation.isPending}
                            data-ocid={`attendance.mapping.save_button.${i + 1}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingBioId(null)}
                            data-ocid={`attendance.mapping.cancel_button.${i + 1}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(bioId, wId)}
                          data-ocid={`attendance.mapping.edit_button.${i + 1}`}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const canImport = role === "Admin" || role === "WorkshopManager";
  const isAdmin = role === "Admin";

  // Load workers
  const { data: workers = [] } = useQuery({
    queryKey: ["workers"],
    queryFn: () => actor!.listWorkers(null),
    enabled: !!actor && !isFetching,
  });

  // Daily attendance for selected date
  const { data: dailyRecords = [], isLoading: isDailyLoading } = useQuery({
    queryKey: ["attendance-daily", selectedDate],
    queryFn: () =>
      actor!.queryAttendance({ fromDate: selectedDate, toDate: selectedDate }),
    enabled: !!actor && !isFetching,
  });

  const lateCount = dailyRecords.filter((r) => r.isLate).length;
  const absentCount = dailyRecords.filter((r) => r.isAbsent).length;
  const presentCount = dailyRecords.filter(
    (r) => !r.isAbsent && !r.isLate,
  ).length;

  function handleExport() {
    exportToCSV(dailyRecords, workers);
    toast.success("Exported attendance records");
  }

  return (
    <div data-ocid="attendance.page" className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Biometric attendance records, monthly summaries, and CSV import
          </p>
        </div>
        {dailyRecords.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-ocid="attendance.export_button"
            className="gap-2"
          >
            <Download size={14} />
            Export CSV
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Present
            </p>
            <p className="text-2xl font-bold font-display mt-1 text-emerald-700 tabular-nums">
              {presentCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 uppercase tracking-wide font-medium">
              Late
            </p>
            <p className="text-2xl font-bold font-display mt-1 text-amber-800 tabular-nums">
              {lateCount}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 uppercase tracking-wide font-medium">
              Absent
            </p>
            <p className="text-2xl font-bold font-display mt-1 text-red-800 tabular-nums">
              {absentCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly alert banner */}
      {(lateCount > 0 || absentCount > 0) && (
        <div
          data-ocid="attendance.anomaly_banner"
          className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
        >
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Attendance anomalies detected</span>{" "}
            for{" "}
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {lateCount > 0 && (
              <>
                {" "}
                —{" "}
                <span className="font-medium text-amber-700">
                  {lateCount} late
                </span>
              </>
            )}
            {absentCount > 0 && (
              <>
                {" "}
                and{" "}
                <span className="font-medium text-red-700">
                  {absentCount} absent
                </span>
              </>
            )}
          </p>
        </div>
      )}

      {/* Main tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-0"
      >
        <div className="flex items-center justify-between border-b border-border pb-0">
          <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
            <TabsTrigger
              value="daily"
              data-ocid="attendance.daily.tab"
              className="px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
            >
              <Calendar size={14} className="mr-1.5" />
              Daily View
            </TabsTrigger>
            <TabsTrigger
              value="monthly"
              data-ocid="attendance.monthly.tab"
              className="px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
            >
              <ChevronRight size={14} className="mr-1.5" />
              Monthly View
            </TabsTrigger>
            {canImport && (
              <TabsTrigger
                value="import"
                data-ocid="attendance.import.tab"
                className="px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
              >
                <Upload size={14} className="mr-1.5" />
                Import CSV
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger
                value="mapping"
                data-ocid="attendance.mapping.tab"
                className="px-4 py-2.5 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
              >
                <Link2 size={14} className="mr-1.5" />
                Biometric Mapping
              </TabsTrigger>
            )}
          </TabsList>

          {/* Date picker — only visible on daily tab */}
          {activeTab === "daily" && (
            <div className="flex items-center gap-2 pb-2">
              <Label
                htmlFor="selectedDate"
                className="text-xs text-muted-foreground sr-only"
              >
                Date
              </Label>
              <Input
                id="selectedDate"
                type="date"
                data-ocid="attendance.date.input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
          )}
        </div>

        <Card className="border border-border rounded-tl-none">
          <TabsContent value="daily" className="mt-0 focus-visible:ring-0">
            <DailyView
              records={dailyRecords}
              workers={workers}
              isLoading={isDailyLoading}
            />
          </TabsContent>

          <TabsContent value="monthly" className="mt-0 focus-visible:ring-0">
            <MonthlyView
              actor={actor}
              isFetchingActor={isFetching}
              workers={workers}
            />
          </TabsContent>

          {canImport && (
            <TabsContent value="import" className="mt-0 focus-visible:ring-0">
              <CsvImport actor={actor} isFetchingActor={isFetching} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="mapping" className="mt-0 focus-visible:ring-0">
              <BiometricMapping
                actor={actor}
                isFetchingActor={isFetching}
                workers={workers}
              />
            </TabsContent>
          )}
        </Card>
      </Tabs>
    </div>
  );
}
