// Re-export all backend types
export type {
  Worker,
  WorkerId,
  Job,
  JobId,
  Assignment,
  NotificationRecord,
  NotificationId,
  AuditEntry,
  AuditEntryId,
  IncentiveLedgerEntry,
  AttendanceRecord,
  AttendanceId,
  AppSettings,
  Product,
  ProductId,
  TimerRecordView,
  IncentivePoolView,
  AttendanceSummary,
  JobStatusEntry,
  ReassignmentEntry,
  AssistShare,
  NotificationTemplate,
  TemplateId,
  BiometricRawRecord,
  CreateWorkerInput,
  UpdateWorkerInput,
  CreateJobInput,
  UpdateJobInput,
  ChangeJobStatusInput,
  CreateProductInput,
  BulkUpsertProductInput,
  AssignWorkersInput,
  ReassignWorkerInput,
  CreateNotificationInput,
  UpsertTemplateInput,
  ImportAttendanceInput,
  AttendanceFilter,
  AuditQueryFilter,
  UpdateSettingsInput,
  WorkerTimeEntry,
  Timestamp,
} from "../backend.d.ts";

export {
  JobStatus,
  JobPriority,
  WorkerStatus,
  UserRole,
  RecipientRole,
  NotificationTrigger,
  AuditEntityType,
  BiometricEvent,
  IncentiveStatus,
  TimerState,
} from "../backend";

// App-level role type
export type AppRole = "Admin" | "SalesManager" | "WorkshopManager";

// Nav item
export interface NavItem {
  label: string;
  path: string;
  icon: string;
}
