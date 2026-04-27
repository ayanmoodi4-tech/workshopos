import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Car,
  ChevronLeft,
  Loader2,
  PlusCircle,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { JobPriority } from "../../backend";
import { useAuth } from "../../hooks/use-auth";
import { useBackendActor } from "../../lib/api";

const COMPLEXITY_LABELS: Record<string, string> = {
  "1": "1 – Very Simple",
  "2": "2 – Simple",
  "3": "3 – Moderate",
  "4": "4 – Complex",
  "5": "5 – Very Complex",
};

interface FieldError {
  customerName?: string;
  customerPhone?: string;
  carMake?: string;
  carModel?: string;
  carYear?: string;
  carPlate?: string;
  description?: string;
  estimatedHours?: string;
  projectPrice?: string;
}

function validate(form: {
  customerName: string;
  customerPhone: string;
  carMake: string;
  carModel: string;
  carYear: string;
  carPlate: string;
  description: string;
  estimatedHours: string;
  projectPrice: string;
}): FieldError {
  const errors: FieldError = {};
  if (!form.customerName.trim())
    errors.customerName = "Customer name is required";
  if (form.customerPhone && !/^\+?[\d\s\-()]{7,15}$/.test(form.customerPhone))
    errors.customerPhone = "Enter a valid phone number";
  if (!form.carMake.trim()) errors.carMake = "Car make is required";
  if (!form.carModel.trim()) errors.carModel = "Car model is required";
  if (
    !form.carYear ||
    Number(form.carYear) < 1900 ||
    Number(form.carYear) > new Date().getFullYear() + 1
  )
    errors.carYear = "Enter a valid year";
  if (!form.carPlate.trim()) errors.carPlate = "Plate number is required";
  if (!form.description.trim()) errors.description = "Description is required";
  if (!form.estimatedHours || Number(form.estimatedHours) < 1)
    errors.estimatedHours = "At least 1 hour required";
  if (!form.projectPrice || Number(form.projectPrice) < 0)
    errors.projectPrice = "Enter a valid price";
  return errors;
}

export default function JobCreate() {
  const { actor, isFetching } = useBackendActor();
  const { role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    carMake: "",
    carModel: "",
    carYear: "",
    carPlate: "",
    description: "",
    estimatedHours: "",
    projectPrice: "",
    priority: JobPriority.medium,
    complexity: "2",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [selectedProductIds, setSelectedProductIds] = useState<bigint[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => actor!.listActiveProducts(),
    enabled: !!actor && !isFetching,
  });

  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.createJob({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        carMake: form.carMake.trim(),
        carModel: form.carModel.trim(),
        carYear: BigInt(form.carYear),
        carPlate: form.carPlate.trim().toUpperCase(),
        description: form.description.trim(),
        estimatedHours: BigInt(form.estimatedHours),
        projectPrice: BigInt(
          Math.round(Number.parseFloat(form.projectPrice || "0")),
        ),
        priority: form.priority as JobPriority,
        complexity: BigInt(form.complexity || "2"),
        productIds: selectedProductIds,
      });
    },
    onSuccess: (job) => {
      toast.success(`Job ${job.jobId} created successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin.allJobs"] });
      queryClient.invalidateQueries({ queryKey: ["sales.allJobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobboard.allJobs"] });
      const prefix = role === "Admin" ? "/admin" : "/sales";
      navigate({ to: `${prefix}/jobs/${job.jobId}` });
    },
    onError: () => toast.error("Failed to create job. Please try again."),
  });

  const handleSubmit = () => {
    // Mark all fields touched to show errors
    const allTouched: Record<string, boolean> = {};
    for (const k of Object.keys(form)) {
      allTouched[k] = true;
    }
    setTouched(allTouched);
    if (!hasErrors) mutation.mutate();
  };

  const fieldError = (k: keyof FieldError) =>
    touched[k] ? errors[k] : undefined;

  return (
    <div data-ocid="job_create.page" className="max-w-3xl space-y-5">
      {/* Page Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: role === "Admin" ? "/admin/jobs" : "/sales/job-board",
            })
          }
          data-ocid="job_create.back_button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-xl font-bold font-display text-foreground">
            Create Job Card
          </h1>
          <p className="text-sm text-muted-foreground">
            New car service or modification job
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Details */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customerName">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customerName"
                data-ocid="job_create.customer_name.input"
                value={form.customerName}
                onChange={set("customerName")}
                onBlur={blur("customerName")}
                placeholder="Full name"
                className={
                  fieldError("customerName") ? "border-destructive" : ""
                }
              />
              {fieldError("customerName") && (
                <p
                  data-ocid="job_create.customer_name.field_error"
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <AlertCircle size={11} />
                  {fieldError("customerName")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerPhone">Phone Number</Label>
              <Input
                id="customerPhone"
                data-ocid="job_create.customer_phone.input"
                value={form.customerPhone}
                onChange={set("customerPhone")}
                onBlur={blur("customerPhone")}
                placeholder="+971 50 000 0000"
                className={
                  fieldError("customerPhone") ? "border-destructive" : ""
                }
              />
              {fieldError("customerPhone") && (
                <p
                  data-ocid="job_create.customer_phone.field_error"
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <AlertCircle size={11} />
                  {fieldError("customerPhone")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Details */}
        <Card className="bg-card border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Car size={14} />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="carMake">
                  Make <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="carMake"
                  data-ocid="job_create.car_make.input"
                  value={form.carMake}
                  onChange={set("carMake")}
                  onBlur={blur("carMake")}
                  placeholder="Toyota"
                  className={fieldError("carMake") ? "border-destructive" : ""}
                />
                {fieldError("carMake") && (
                  <p
                    data-ocid="job_create.car_make.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("carMake")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carModel">
                  Model <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="carModel"
                  data-ocid="job_create.car_model.input"
                  value={form.carModel}
                  onChange={set("carModel")}
                  onBlur={blur("carModel")}
                  placeholder="Camry"
                  className={fieldError("carModel") ? "border-destructive" : ""}
                />
                {fieldError("carModel") && (
                  <p
                    data-ocid="job_create.car_model.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("carModel")}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="carYear">
                  Year <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="carYear"
                  data-ocid="job_create.car_year.input"
                  value={form.carYear}
                  onChange={set("carYear")}
                  onBlur={blur("carYear")}
                  placeholder="2023"
                  type="number"
                  min="1900"
                  max={String(new Date().getFullYear() + 1)}
                  className={fieldError("carYear") ? "border-destructive" : ""}
                />
                {fieldError("carYear") && (
                  <p
                    data-ocid="job_create.car_year.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("carYear")}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carPlate">
                  Plate <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="carPlate"
                  data-ocid="job_create.car_plate.input"
                  value={form.carPlate}
                  onChange={set("carPlate")}
                  onBlur={blur("carPlate")}
                  placeholder="ABC 1234"
                  className={
                    fieldError("carPlate")
                      ? "border-destructive uppercase"
                      : "uppercase"
                  }
                />
                {fieldError("carPlate") && (
                  <p
                    data-ocid="job_create.car_plate.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("carPlate")}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card className="bg-card border border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Work Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                data-ocid="job_create.description.textarea"
                value={form.description}
                onChange={set("description")}
                onBlur={blur("description")}
                placeholder="Describe the work to be performed in detail..."
                rows={3}
                className={
                  fieldError("description") ? "border-destructive" : ""
                }
              />
              {fieldError("description") && (
                <p
                  data-ocid="job_create.description.field_error"
                  className="text-xs text-destructive flex items-center gap-1"
                >
                  <AlertCircle size={11} />
                  {fieldError("description")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="estimatedHours">
                  Est. Hours <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="estimatedHours"
                  data-ocid="job_create.estimated_hours.input"
                  value={form.estimatedHours}
                  onChange={set("estimatedHours")}
                  onBlur={blur("estimatedHours")}
                  placeholder="8"
                  type="number"
                  min="1"
                  className={
                    fieldError("estimatedHours") ? "border-destructive" : ""
                  }
                />
                {fieldError("estimatedHours") && (
                  <p
                    data-ocid="job_create.estimated_hours.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("estimatedHours")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="projectPrice">
                  Price (AED) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectPrice"
                  data-ocid="job_create.project_price.input"
                  value={form.projectPrice}
                  onChange={set("projectPrice")}
                  onBlur={blur("projectPrice")}
                  placeholder="1500"
                  type="number"
                  min="0"
                  className={
                    fieldError("projectPrice") ? "border-destructive" : ""
                  }
                />
                {fieldError("projectPrice") && (
                  <p
                    data-ocid="job_create.project_price.field_error"
                    className="text-xs text-destructive"
                  >
                    {fieldError("projectPrice")}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as JobPriority }))
                  }
                >
                  <SelectTrigger data-ocid="job_create.priority.select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={JobPriority.low}>Low</SelectItem>
                    <SelectItem value={JobPriority.medium}>Medium</SelectItem>
                    <SelectItem value={JobPriority.high}>High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Complexity</Label>
                <Select
                  value={form.complexity}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, complexity: v }))
                  }
                >
                  <SelectTrigger data-ocid="job_create.complexity.select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4", "5"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {COMPLEXITY_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        {products.length > 0 && (
          <Card className="bg-card border border-border lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">
                Products / Parts
                {selectedProductIds.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({selectedProductIds.length} selected)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => {
                  const selected = selectedProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id.toString()}
                      type="button"
                      onClick={() =>
                        setSelectedProductIds((prev) =>
                          selected
                            ? prev.filter((id) => id !== p.id)
                            : [...prev, p.id],
                        )
                      }
                      data-ocid={`job_create.product.${p.id}`}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-smooth ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-ring hover:bg-muted/40"
                      }`}
                    >
                      {selected && <X size={10} />}
                      {p.name}
                      {p.code && <span className="opacity-60">({p.code})</span>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          data-ocid="job_create.submit_button"
        >
          {mutation.isPending ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <PlusCircle size={16} className="mr-2" />
              Create Job Card
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            navigate({ to: role === "Admin" ? "/admin" : "/sales" })
          }
          data-ocid="job_create.cancel_button"
        >
          Cancel
        </Button>
        {mutation.isError && (
          <p
            data-ocid="job_create.error_state"
            className="text-xs text-destructive flex items-center gap-1"
          >
            <AlertCircle size={12} />
            Failed to create job — please try again
          </p>
        )}
      </div>
    </div>
  );
}
