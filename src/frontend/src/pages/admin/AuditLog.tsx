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
import { useBackendActor } from "@/lib/api";
import { AuditEntityType } from "@/types";
import type { AuditEntry } from "@/types";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

const PAGE_SIZE = 25;

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  [AuditEntityType.job]: "Job",
  [AuditEntityType.worker]: "Worker",
  [AuditEntityType.assignment]: "Assignment",
  [AuditEntityType.product]: "Product",
  [AuditEntityType.setting]: "Setting",
  [AuditEntityType.notification]: "Notification",
  [AuditEntityType.attendance]: "Attendance",
  [AuditEntityType.incentive]: "Incentive",
};

const ENTITY_TYPE_BADGE_CLASS: Record<AuditEntityType, string> = {
  [AuditEntityType.job]: "bg-blue-100 text-blue-700 border-blue-300",
  [AuditEntityType.worker]: "bg-violet-100 text-violet-700 border-violet-300",
  [AuditEntityType.assignment]: "bg-cyan-100 text-cyan-700 border-cyan-300",
  [AuditEntityType.product]: "bg-amber-100 text-amber-700 border-amber-300",
  [AuditEntityType.setting]: "bg-slate-100 text-slate-700 border-slate-300",
  [AuditEntityType.notification]:
    "bg-orange-100 text-orange-700 border-orange-300",
  [AuditEntityType.attendance]: "bg-teal-100 text-teal-700 border-teal-300",
  [AuditEntityType.incentive]:
    "bg-emerald-100 text-emerald-700 border-emerald-300",
};

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncatePrincipal(p: { toString(): string }): string {
  const s = p.toString();
  if (s.length <= 20) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function exportCSV(entries: AuditEntry[]) {
  const header = [
    "ID",
    "Entity Type",
    "Entity ID",
    "Action",
    "Actor Principal",
    "Details",
    "Timestamp",
  ];
  const rows = entries.map((e) => [
    e.id.toString(),
    e.entityType,
    e.entityId,
    `"${e.action.replace(/"/g, '""')}"`,
    e.actorPrincipal.toString(),
    `"${e.details.replace(/"/g, '""')}"`,
    formatTimestamp(e.timestamp),
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLog() {
  const { actor, isFetching } = useBackendActor();

  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [actionSearch, setActionSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  // Build timestamp filters
  const fromTime = fromDate
    ? BigInt(new Date(fromDate).getTime()) * 1_000_000n
    : undefined;
  const toTime = toDate
    ? BigInt(new Date(`${toDate}T23:59:59`).getTime()) * 1_000_000n
    : undefined;
  const entityType =
    entityTypeFilter !== "all"
      ? (entityTypeFilter as AuditEntityType)
      : undefined;

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["auditLog", entityTypeFilter, fromDate, toDate],
    queryFn: async () => {
      if (!actor) return [];
      return actor.queryAuditLog({ entityType, fromTime, toTime });
    },
    enabled: !!actor && !isFetching,
  });

  // Client-side action text search + sort newest first
  const filtered = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    let result = [...entries].sort((a, b) =>
      a.timestamp > b.timestamp ? -1 : 1,
    );
    if (q) {
      result = result.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          e.entityId.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, actionSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function handleFilterChange() {
    setPage(1);
  }

  return (
    <div className="p-6 space-y-5" data-ocid="audit_log.page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Full immutable history of all system actions. Read-only.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          data-ocid="audit_log.export_button"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Entity type */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label
              htmlFor="filter-entity-type"
              className="text-xs font-medium text-muted-foreground"
            >
              Entity Type
            </label>
            <Select
              value={entityTypeFilter}
              onValueChange={(v) => {
                setEntityTypeFilter(v);
                handleFilterChange();
              }}
            >
              <SelectTrigger
                id="filter-entity-type"
                className="h-9"
                data-ocid="audit_log.entity_type_select"
              >
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.values(AuditEntityType).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ENTITY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From date */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-from-date"
              className="text-xs font-medium text-muted-foreground"
            >
              From Date
            </label>
            <Input
              id="filter-from-date"
              type="date"
              className="h-9 w-[160px]"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                handleFilterChange();
              }}
              data-ocid="audit_log.from_date_input"
            />
          </div>

          {/* To date */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-to-date"
              className="text-xs font-medium text-muted-foreground"
            >
              To Date
            </label>
            <Input
              id="filter-to-date"
              type="date"
              className="h-9 w-[160px]"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                handleFilterChange();
              }}
              data-ocid="audit_log.to_date_input"
            />
          </div>

          {/* Action search */}
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label
              htmlFor="filter-action-search"
              className="text-xs font-medium text-muted-foreground"
            >
              Search Actions
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="filter-action-search"
                className="h-9 pl-8"
                placeholder="Search action, entity ID, details…"
                value={actionSearch}
                onChange={(e) => {
                  setActionSearch(e.target.value);
                  setPage(1);
                }}
                data-ocid="audit_log.search_input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading || isFetching ? (
          <div className="p-4 space-y-3" data-ocid="audit_log.loading_state">
            {["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"].map((k) => (
              <Skeleton key={k} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-3 text-center"
            data-ocid="audit_log.empty_state"
          >
            <ShieldAlert className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-foreground">
              No audit entries found
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {actionSearch || entityTypeFilter !== "all" || fromDate || toDate
                ? "Try adjusting your filters."
                : "No actions have been recorded yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Entity ID
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Details
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((entry, idx) => (
                  <tr
                    key={entry.id.toString()}
                    className="hover:bg-muted/20 transition-colors"
                    data-ocid={`audit_log.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${ENTITY_TYPE_BADGE_CLASS[entry.entityType]}`}
                      >
                        {ENTITY_TYPE_LABELS[entry.entityType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground">
                        {entry.entityId || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <span
                        className="font-medium text-foreground truncate block"
                        title={entry.action}
                      >
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <span
                        className="text-muted-foreground truncate block"
                        title={entry.details}
                      >
                        {entry.details || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {truncatePrincipal(entry.actorPrincipal)}
                      </code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, filtered.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {filtered.length}
            </span>{" "}
            entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-ocid="audit_log.pagination_prev"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-1">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-ocid="audit_log.pagination_next"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
