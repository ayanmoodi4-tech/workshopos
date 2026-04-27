import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackendActor } from "@/lib/api";
import type { AppSettings, UpdateSettingsInput } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, Percent, Save, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Convert lateThresholdMinutes (minutes past midnight) to HH:MM string
function minutesToHHMM(totalMinutes: bigint): string {
  const m = Number(totalMinutes);
  const hh = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const mm = (m % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

// Convert HH:MM string back to total minutes past midnight
function hhmmToMinutes(hhmm: string): bigint {
  const [hh, mm] = hhmm.split(":").map(Number);
  return BigInt((hh || 0) * 60 + (mm || 0));
}

interface SettingsFormState {
  incentivePoolPercent: string;
  earlyBonusThresholdPercent: string;
  lateThreshold: string; // HH:MM
  absentFlagDays: string;
  idleDetectionMinutes: string;
  overdueAlertOffsetHours: string;
}

function defaultForm(settings?: AppSettings): SettingsFormState {
  if (!settings) {
    return {
      incentivePoolPercent: "5",
      earlyBonusThresholdPercent: "90",
      lateThreshold: "09:00",
      absentFlagDays: "1",
      idleDetectionMinutes: "15",
      overdueAlertOffsetHours: "1",
    };
  }
  return {
    incentivePoolPercent: settings.incentivePoolPercent.toString(),
    earlyBonusThresholdPercent: settings.earlyBonusThresholdPercent.toString(),
    lateThreshold: minutesToHHMM(settings.lateThresholdMinutes),
    absentFlagDays: settings.absentFlagDays.toString(),
    idleDetectionMinutes: settings.idleDetectionMinutes.toString(),
    overdueAlertOffsetHours: settings.overdueAlertOffsetHours.toString(),
  };
}

interface SettingSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingSection({
  icon,
  title,
  description,
  children,
}: SettingSectionProps) {
  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              {title}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-0.5">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div>
      </CardContent>
    </Card>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  ocid: string;
}

function SettingField({ label, hint, children, ocid }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground" data-ocid={ocid}>
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const { actor, isFetching } = useBackendActor();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getSettings();
    },
    enabled: !!actor && !isFetching,
  });

  const [form, setForm] = useState<SettingsFormState>(() =>
    defaultForm(undefined),
  );
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(defaultForm(settings));
      setIsDirty(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateSettingsInput) => {
      if (!actor) throw new Error("No actor");
      return actor.updateSettings(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setIsDirty(false);
      toast.success("Settings saved successfully.");
    },
    onError: () => {
      toast.error("Failed to save settings. Please try again.");
    },
  });

  function handleChange(field: keyof SettingsFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }

  function handleSave() {
    const input: UpdateSettingsInput = {
      incentivePoolPercent: BigInt(
        Number.parseInt(form.incentivePoolPercent, 10) || 5,
      ),
      earlyBonusThresholdPercent: BigInt(
        Number.parseInt(form.earlyBonusThresholdPercent, 10) || 90,
      ),
      lateThresholdMinutes: hhmmToMinutes(form.lateThreshold),
      absentFlagDays: BigInt(Number.parseInt(form.absentFlagDays, 10) || 1),
      idleDetectionMinutes: BigInt(
        Number.parseInt(form.idleDetectionMinutes, 10) || 15,
      ),
      overdueAlertOffsetHours: BigInt(
        Number.parseInt(form.overdueAlertOffsetHours, 10) || 1,
      ),
    };
    updateMutation.mutate(input);
  }

  if (isLoading || isFetching) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-border">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl" data-ocid="settings.page">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground">
            System Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure incentive thresholds, attendance rules, and alert
            behaviour.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="shrink-0"
          data-ocid="settings.save_button"
        >
          <Save className="w-4 h-4 mr-2" />
          {updateMutation.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {/* Incentive Settings */}
      <SettingSection
        icon={<Percent className="w-4 h-4" />}
        title="Incentive Settings"
        description="Control how incentive pools are calculated and distributed."
      >
        <SettingField
          label="Incentive Pool %"
          hint="Percentage of project price allocated to the incentive pool."
          ocid="settings.incentive_pool_label"
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={form.incentivePoolPercent}
            onChange={(e) =>
              handleChange("incentivePoolPercent", e.target.value)
            }
            data-ocid="settings.incentive_pool_input"
          />
        </SettingField>
        <SettingField
          label="Early Bonus Threshold %"
          hint="If job completes within this % of estimated time, early bonus applies."
          ocid="settings.early_bonus_label"
        >
          <Input
            type="number"
            min={0}
            max={100}
            value={form.earlyBonusThresholdPercent}
            onChange={(e) =>
              handleChange("earlyBonusThresholdPercent", e.target.value)
            }
            data-ocid="settings.early_bonus_input"
          />
        </SettingField>
      </SettingSection>

      {/* Attendance Settings */}
      <SettingSection
        icon={<Clock className="w-4 h-4" />}
        title="Attendance Settings"
        description="Define work start time and absence detection thresholds."
      >
        <SettingField
          label="Work Start Time (Late Threshold)"
          hint="Workers checking in after this time are marked late."
          ocid="settings.late_threshold_label"
        >
          <Input
            type="time"
            value={form.lateThreshold}
            onChange={(e) => handleChange("lateThreshold", e.target.value)}
            data-ocid="settings.late_threshold_input"
          />
        </SettingField>
        <SettingField
          label="Absent Flag Days"
          hint="Number of consecutive missing days before flagging as absent."
          ocid="settings.absent_flag_label"
        >
          <Input
            type="number"
            min={1}
            value={form.absentFlagDays}
            onChange={(e) => handleChange("absentFlagDays", e.target.value)}
            data-ocid="settings.absent_flag_input"
          />
        </SettingField>
      </SettingSection>

      {/* Alert Settings */}
      <SettingSection
        icon={<Bell className="w-4 h-4" />}
        title="Alert Settings"
        description="Configure when idle and overdue alerts are triggered."
      >
        <SettingField
          label="Idle Detection (minutes)"
          hint="Minutes without activity before a job is flagged as idle."
          ocid="settings.idle_minutes_label"
        >
          <Input
            type="number"
            min={1}
            value={form.idleDetectionMinutes}
            onChange={(e) =>
              handleChange("idleDetectionMinutes", e.target.value)
            }
            data-ocid="settings.idle_minutes_input"
          />
        </SettingField>
        <SettingField
          label="Overdue Alert Offset (hours)"
          hint="Hours after estimated completion time before an overdue alert fires."
          ocid="settings.overdue_offset_label"
        >
          <Input
            type="number"
            min={0}
            value={form.overdueAlertOffsetHours}
            onChange={(e) =>
              handleChange("overdueAlertOffsetHours", e.target.value)
            }
            data-ocid="settings.overdue_offset_input"
          />
        </SettingField>
      </SettingSection>

      {/* Sticky save bar when dirty */}
      {isDirty && (
        <div className="sticky bottom-6 flex justify-end">
          <div className="bg-card border border-border shadow-md rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              You have unsaved changes.
            </span>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-ocid="settings.sticky_save_button"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
