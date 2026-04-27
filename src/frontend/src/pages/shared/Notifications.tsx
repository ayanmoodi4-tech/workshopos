import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NotificationTrigger } from "../../backend";
import type {
  NotificationRecord,
  NotificationTemplate,
  UpsertTemplateInput,
} from "../../backend.d.ts";
import { useAuth } from "../../hooks/use-auth";
import {
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from "../../hooks/use-notifications";
import { useBackendActor } from "../../lib/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: bigint): string {
  const ms = Date.now() - Number(ts / 1_000_000n);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const d = new Date(Number(ts / 1_000_000n));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getDateGroup(ts: bigint): "today" | "yesterday" | "older" {
  const ms = Date.now() - Number(ts / 1_000_000n);
  const hours = ms / 3_600_000;
  if (hours < 24) return "today";
  if (hours < 48) return "yesterday";
  return "older";
}

const GROUP_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  older: "Earlier",
};

// ─── trigger badge ────────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { label: string; className: string }> = {
  [NotificationTrigger.job_created]: {
    label: "Job Created",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  [NotificationTrigger.status_changed]: {
    label: "Status Changed",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  [NotificationTrigger.job_completed]: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  [NotificationTrigger.overdue]: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  [NotificationTrigger.worker_idle]: {
    label: "Worker Idle",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  [NotificationTrigger.incentive_awarded]: {
    label: "Incentive",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  [NotificationTrigger.attendance_anomaly]: {
    label: "Attendance",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

function getTriggerMeta(trigger: string) {
  return (
    TRIGGER_META[trigger] ?? {
      label: trigger.replace(/_/g, " "),
      className: "bg-muted text-muted-foreground border-border",
    }
  );
}

// ─── entity link helper ───────────────────────────────────────────────────────

function entityPath(
  trigger: NotificationTrigger,
  entityId?: string,
): string | null {
  if (!entityId) return null;
  if (
    trigger === NotificationTrigger.job_created ||
    trigger === NotificationTrigger.status_changed ||
    trigger === NotificationTrigger.job_completed ||
    trigger === NotificationTrigger.overdue
  ) {
    return `/jobs/${entityId}`;
  }
  if (trigger === NotificationTrigger.worker_idle) {
    return `/workers/${entityId}`;
  }
  if (trigger === NotificationTrigger.attendance_anomaly) {
    return "/attendance";
  }
  return null;
}

// ─── notification card ────────────────────────────────────────────────────────

interface NotifCardProps {
  notif: NotificationRecord;
  index: number;
  onMarkRead: (id: bigint) => void;
  onNavigate: (path: string) => void;
}

function NotifCard({ notif, index, onMarkRead, onNavigate }: NotifCardProps) {
  const isRead = notif.readBy.length > 0;
  const meta = getTriggerMeta(notif.trigger);
  const link = entityPath(notif.trigger, notif.entityId);

  const handleClick = () => {
    if (!isRead) onMarkRead(notif.id);
    if (link) onNavigate(link);
  };

  return (
    <button
      type="button"
      data-ocid={`notifications.item.${index}`}
      onClick={handleClick}
      className={[
        "group flex items-start gap-3 w-full text-left rounded-lg border px-4 py-3 transition-smooth",
        isRead
          ? "bg-card border-border hover:border-ring/60"
          : "bg-primary/5 border-primary/25 hover:border-primary/50",
      ].join(" ")}
    >
      {/* unread dot */}
      <div className="shrink-0 mt-1.5 w-2 h-2 flex items-center justify-center">
        {!isRead && (
          <Circle
            size={8}
            className="fill-primary text-primary"
            aria-label="Unread"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={[
              "text-sm truncate",
              isRead
                ? "font-medium text-foreground"
                : "font-semibold text-foreground",
            ].join(" ")}
          >
            {notif.title}
          </p>
          <span className="text-xs text-muted-foreground shrink-0 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {timeAgo(notif.createdAt)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notif.message}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span
            className={[
              "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border",
              meta.className,
            ].join(" ")}
          >
            {meta.label}
          </span>
          {notif.entityId && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {notif.entityId}
            </span>
          )}
          {link && (
            <span className="ml-auto text-xs text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-smooth">
              View <ChevronRight size={11} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── template hooks ───────────────────────────────────────────────────────────

function useNotificationTemplates() {
  const { actor, isFetching } = useBackendActor();
  const { isAuthenticated } = useAuth();

  return useQuery<NotificationTemplate[]>({
    queryKey: ["notificationTemplates"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listNotificationTemplates();
    },
    enabled: !!actor && !isFetching && isAuthenticated,
    refetchInterval: 10_000,
  });
}

function useUpsertTemplate() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();

  return async (input: UpsertTemplateInput) => {
    if (!actor) throw new Error("No actor");
    await actor.upsertNotificationTemplate(input);
    queryClient.invalidateQueries({ queryKey: ["notificationTemplates"] });
  };
}

// ─── edit template modal ──────────────────────────────────────────────────────

const AVAILABLE_VARS = [
  "{job_id}",
  "{worker_name}",
  "{status}",
  "{time_remaining}",
];

interface EditTemplateModalProps {
  template: NotificationTemplate | null;
  onClose: () => void;
}

function EditTemplateModal({ template, onClose }: EditTemplateModalProps) {
  const upsert = useUpsertTemplate();
  const [titleTemplate, setTitleTemplate] = useState(
    template?.titleTemplate ?? "",
  );
  const [messageTemplate, setMessageTemplate] = useState(
    template?.messageTemplate ?? "",
  );
  const [active, setActive] = useState(template?.active ?? true);
  const [saving, setSaving] = useState(false);

  if (!template) return null;

  const meta = getTriggerMeta(template.trigger);

  const handleSave = async () => {
    if (!titleTemplate.trim() || !messageTemplate.trim()) return;
    setSaving(true);
    try {
      await upsert({
        trigger: template.trigger,
        titleTemplate: titleTemplate.trim(),
        messageTemplate: messageTemplate.trim(),
        active,
      });
      toast.success("Template saved", {
        description: `${meta.label} template updated successfully.`,
      });
      onClose();
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg"
        data-ocid="notifications.template_edit_dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            Edit Template
            <span
              className={[
                "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border",
                meta.className,
              ].join(" ")}
            >
              {meta.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title-tpl">Title Template</Label>
            <Input
              id="title-tpl"
              data-ocid="notifications.template_title_input"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              placeholder="e.g. Job {job_id} is overdue"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-tpl">Message Template</Label>
            <Textarea
              id="msg-tpl"
              data-ocid="notifications.template_message_textarea"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder="e.g. Worker {worker_name} has been idle on {job_id}."
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="bg-muted/40 rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-foreground mb-2">
              Available variables
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="text-xs bg-card border border-border rounded px-1.5 py-0.5 font-mono text-primary cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => setMessageTemplate((prev) => `${prev} ${v}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      setMessageTemplate((prev) => `${prev} ${v}`);
                  }}
                  title="Click to insert"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label
              htmlFor="active-toggle"
              className="text-sm font-medium cursor-pointer"
            >
              Active
              <span className="block text-xs text-muted-foreground font-normal">
                Inactive templates will not generate notifications
              </span>
            </Label>
            <Switch
              id="active-toggle"
              data-ocid="notifications.template_active_switch"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              data-ocid="notifications.template_cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving || !titleTemplate.trim() || !messageTemplate.trim()
              }
              data-ocid="notifications.template_save_button"
            >
              {saving ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── templates tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
  const { data: templates = [], isLoading } = useNotificationTemplates();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div
        data-ocid="notifications.templates_empty_state"
        className="text-center py-16 bg-muted/30 rounded-lg border border-border mt-4"
      >
        <Bell size={28} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">
          No templates found
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Templates are created automatically when notifications are triggered.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2" data-ocid="notifications.templates_list">
      {templates.map((tpl, i) => {
        const meta = getTriggerMeta(tpl.trigger);
        return (
          <div
            key={tpl.id.toString()}
            data-ocid={`notifications.template_item.${i + 1}`}
            className="flex items-start gap-3 bg-card border border-border rounded-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={[
                    "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border",
                    meta.className,
                  ].join(" ")}
                >
                  {meta.label}
                </span>
                <Badge
                  variant={tpl.active ? "default" : "secondary"}
                  className="text-xs"
                >
                  {tpl.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {tpl.titleTemplate}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {tpl.messageTemplate}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              data-ocid={`notifications.template_edit_button.${i + 1}`}
              onClick={() => setEditing(tpl)}
            >
              <Pencil size={14} className="mr-1.5" />
              Edit
            </Button>
          </div>
        );
      })}

      {editing && (
        <EditTemplateModal
          template={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── notifications tab ────────────────────────────────────────────────────────

type TriggerFilter = "all" | NotificationTrigger;

function groupNotifications(
  notifications: NotificationRecord[],
): { group: string; items: NotificationRecord[] }[] {
  const groups: Record<string, NotificationRecord[]> = {
    today: [],
    yesterday: [],
    older: [],
  };
  for (const n of notifications) {
    groups[getDateGroup(n.createdAt)].push(n);
  }
  return (["today", "yesterday", "older"] as const)
    .filter((g) => groups[g].length > 0)
    .map((g) => ({ group: g, items: groups[g] }));
}

function NotificationsTab() {
  const { notifications, unreadCount, isLoading } = useNotifications();
  const markAllRead = useMarkAllRead();
  const markRead = useMarkNotificationRead();
  const [filter, setFilter] = useState<TriggerFilter>("all");
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.trigger === filter);

  const grouped = groupNotifications(filtered);

  const handleMarkAll = async () => {
    setIsMarkingAll(true);
    try {
      await markAllRead();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleNavigate = (path: string) => {
    window.location.hash = path;
  };

  // count unique triggers for filter options
  const availableTriggers = Array.from(
    new Set(notifications.map((n) => n.trigger)),
  );

  return (
    <div data-ocid="notifications.list_panel" className="space-y-4">
      {/* filter + mark all */}
      <div className="flex items-center gap-3">
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as TriggerFilter)}
        >
          <SelectTrigger
            className="w-48"
            data-ocid="notifications.filter_select"
          >
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notifications</SelectItem>
            {availableTriggers.map((t) => (
              <SelectItem key={t} value={t}>
                {getTriggerMeta(t).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={isMarkingAll}
              data-ocid="notifications.mark_all_read_button"
            >
              <CheckCheck size={14} className="mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-ocid="notifications.empty_state"
          className="text-center py-16 bg-muted/30 rounded-lg border border-border"
        >
          <BellOff size={32} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            {filter === "all"
              ? "No notifications"
              : "No matching notifications"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "all"
              ? "You're all caught up!"
              : "Try changing the filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {GROUP_LABELS[group]}
              </p>
              <div className="space-y-1.5">
                {items.map((notif, i) => (
                  <NotifCard
                    key={notif.id.toString()}
                    notif={notif}
                    index={i + 1}
                    onMarkRead={markRead}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const { role } = useAuth();
  const { unreadCount, isLoading } = useNotifications();
  const isAdmin = role === "Admin";

  return (
    <div data-ocid="notifications.page" className="max-w-2xl space-y-5">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-foreground mb-0 flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {isLoading ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : unreadCount > 0 ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </>
            ) : (
              "All caught up"
            )}
          </p>
        </div>
      </div>

      {/* tabs: notifications + templates (admin only) */}
      <Tabs defaultValue="notifications">
        <TabsList className="h-9" data-ocid="notifications.tabs">
          <TabsTrigger
            value="notifications"
            data-ocid="notifications.notifications_tab"
            className="text-sm"
          >
            Inbox
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-xs font-semibold bg-primary text-primary-foreground rounded-full px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="templates"
              data-ocid="notifications.templates_tab"
              className="text-sm"
            >
              Templates
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="templates" className="mt-0">
            <TemplatesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
