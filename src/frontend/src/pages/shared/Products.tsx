import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Package,
  PowerOff,
  Search,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BulkUpsertProductInput, Product } from "../../backend.d.ts";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";

function parseProductsCsv(text: string): BulkUpsertProductInput[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  // Expect header: Name,Code,Notes (case-insensitive)
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name");
  const codeIdx = header.findIndex((h) => h === "code");
  const notesIdx = header.findIndex((h) => h === "notes");

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const name = nameIdx >= 0 ? (cols[nameIdx] ?? "") : (cols[0] ?? "");
      const code = codeIdx >= 0 ? cols[codeIdx] : undefined;
      const notes = notesIdx >= 0 ? cols[notesIdx] : undefined;
      return {
        name,
        code: code || undefined,
        notes: notes || undefined,
      };
    })
    .filter((p) => p.name);
}

export default function Products() {
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products.all"],
    queryFn: async () => {
      if (!actor) return [];
      // listActiveProducts only returns active — for Admin we want all; use listAllJobs pattern
      // Since backend only exposes listActiveProducts, fetch it and show accordingly
      return actor.listActiveProducts();
    },
    enabled: !!actor && !isFetching,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      return actor.deactivateProduct(id);
    },
    onSuccess: () => {
      toast.success("Product deactivated");
      queryClient.invalidateQueries({ queryKey: ["products.all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => toast.error("Failed to deactivate product"),
  });

  const importMutation = useMutation({
    mutationFn: async (inputs: BulkUpsertProductInput[]) => {
      if (!actor) throw new Error("No actor");
      return actor.bulkUpsertProducts(inputs);
    },
    onSuccess: (count) => {
      toast.success(`${Number(count)} products imported successfully`);
      setImportError(null);
      queryClient.invalidateQueries({ queryKey: ["products.all"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: () => {
      toast.error("Import failed. Check CSV format and try again.");
      setImportError("Import failed. Please verify your CSV file.");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setImportError("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseProductsCsv(text);
      if (parsed.length === 0) {
        setImportError(
          "No valid products found. CSV must have a Name column and at least one data row.",
        );
        return;
      }
      setImportError(null);
      importMutation.mutate(parsed);
    };
    reader.readAsText(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code?.toLowerCase().includes(search.toLowerCase()),
  );

  const canImport = role === "Admin" || role === "SalesManager";
  const canDeactivate = role === "Admin";

  return (
    <div data-ocid="products.page" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Products &amp; Parts
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master list of products used in job cards
          </p>
        </div>

        {canImport && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              data-ocid="products.csv_upload"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importMutation.isPending}
              data-ocid="products.import_button"
            >
              {importMutation.isPending ? (
                <>
                  <Upload size={14} className="mr-1.5 animate-bounce" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-1.5" />
                  Import CSV
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* CSV Format hint */}
      {canImport && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2.5">
          <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-primary" />
          <span>
            CSV format:{" "}
            <span className="font-mono text-foreground">Name,Code,Notes</span>{" "}
            (header row required). Code and Notes are optional.
          </span>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div
          data-ocid="products.import.error_state"
          className="flex items-center gap-2 text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
        >
          <AlertCircle size={13} className="shrink-0" />
          {importError}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          data-ocid="products.search_input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card className="bg-card border border-border">
        {isLoading ? (
          <CardContent className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent
            data-ocid="products.empty_state"
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <Package
              size={36}
              className="text-muted-foreground mb-3 opacity-50"
            />
            <p className="text-sm font-semibold text-foreground">
              {search ? "No products match your search" : "No products yet"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {search
                ? "Try a different name or code"
                : "Import a CSV file to add products to the master list"}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Code</TableHead>
                  <TableHead className="text-xs font-semibold">Notes</TableHead>
                  <TableHead className="text-xs font-semibold">
                    Status
                  </TableHead>
                  {canDeactivate && (
                    <TableHead className="text-xs font-semibold text-right">
                      Action
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((product: Product, i) => (
                  <TableRow
                    key={product.id.toString()}
                    data-ocid={`products.item.${i + 1}`}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="font-medium text-sm text-foreground">
                      {product.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {product.code ?? (
                        <span className="italic text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {product.notes ?? (
                        <span className="italic text-muted-foreground/50">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-md border ${
                          product.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {product.active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    {canDeactivate && (
                      <TableCell className="text-right">
                        {product.active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-red-50"
                            onClick={() =>
                              deactivateMutation.mutate(product.id)
                            }
                            disabled={deactivateMutation.isPending}
                            data-ocid={`products.deactivate_button.${i + 1}`}
                          >
                            <PowerOff size={12} className="mr-1" />
                            Deactivate
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {products.length} product
        {products.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
