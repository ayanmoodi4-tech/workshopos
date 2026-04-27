import { useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";
import type {
  AssignWorkersInput,
  AttendanceFilter,
  AuditQueryFilter,
  BulkUpsertProductInput,
  ChangeJobStatusInput,
  CreateJobInput,
  CreateNotificationInput,
  CreateProductInput,
  CreateWorkerInput,
  ImportAttendanceInput,
  JobId,
  JobStatus,
  NotificationId,
  NotificationTrigger,
  ProductId,
  ReassignWorkerInput,
  RecipientRole,
  UpdateJobInput,
  UpdateSettingsInput,
  UpdateWorkerInput,
  UpsertTemplateInput,
  WorkerId,
  WorkerStatus,
  backendInterface,
} from "../backend.d.ts";

type ActorType = backendInterface;

export function useBackendActor(): {
  actor: ActorType | null;
  isFetching: boolean;
} {
  const result = useActor(createActor as Parameters<typeof useActor>[0]);
  return result as { actor: ActorType | null; isFetching: boolean };
}

// Helpers for calling actor
export async function apiListWorkers(
  actor: ActorType,
  status: WorkerStatus | null,
) {
  return actor.listWorkers(status);
}
export async function apiGetWorker(actor: ActorType, id: WorkerId) {
  return actor.getWorker(id);
}
export async function apiCreateWorker(
  actor: ActorType,
  input: CreateWorkerInput,
) {
  return actor.createWorker(input);
}
export async function apiUpdateWorker(
  actor: ActorType,
  input: UpdateWorkerInput,
) {
  return actor.updateWorker(input);
}
export async function apiDeactivateWorker(actor: ActorType, id: WorkerId) {
  return actor.deactivateWorker(id);
}

export async function apiListAllJobs(actor: ActorType) {
  return actor.listAllJobs();
}
export async function apiListJobsByStatus(actor: ActorType, status: JobStatus) {
  return actor.listJobsByStatus(status);
}
export async function apiListJobsByWorker(
  actor: ActorType,
  workerId: WorkerId,
) {
  return actor.listJobsByWorker(workerId);
}
export async function apiGetJob(actor: ActorType, jobId: JobId) {
  return actor.getJob(jobId);
}
export async function apiCreateJob(actor: ActorType, input: CreateJobInput) {
  return actor.createJob(input);
}
export async function apiUpdateJob(actor: ActorType, input: UpdateJobInput) {
  return actor.updateJob(input);
}
export async function apiChangeJobStatus(
  actor: ActorType,
  input: ChangeJobStatusInput,
) {
  return actor.changeJobStatus(input);
}
export async function apiIsJobOverdue(actor: ActorType, jobId: JobId) {
  return actor.isJobOverdue(jobId);
}

export async function apiAssignWorkers(
  actor: ActorType,
  input: AssignWorkersInput,
) {
  return actor.assignWorkers(input);
}
export async function apiGetAssignment(actor: ActorType, jobId: JobId) {
  return actor.getAssignment(jobId);
}
export async function apiReassignPrimaryWorker(
  actor: ActorType,
  input: ReassignWorkerInput,
) {
  return actor.reassignPrimaryWorker(input);
}
export async function apiReassignAssistWorker(
  actor: ActorType,
  input: ReassignWorkerInput,
) {
  return actor.reassignAssistWorker(input);
}

export async function apiStartTimer(actor: ActorType, jobId: JobId) {
  return actor.startJobTimer(jobId);
}
export async function apiPauseTimer(actor: ActorType, jobId: JobId) {
  return actor.pauseJobTimer(jobId);
}
export async function apiResumeTimer(actor: ActorType, jobId: JobId) {
  return actor.resumeJobTimer(jobId);
}
export async function apiStopTimer(actor: ActorType, jobId: JobId) {
  return actor.stopJobTimer(jobId);
}
export async function apiGetTimer(actor: ActorType, jobId: JobId) {
  return actor.getJobTimerState(jobId);
}
export async function apiGetIdleJobs(actor: ActorType) {
  return actor.getIdleJobs();
}

export async function apiGetIncentivePool(actor: ActorType, jobId: JobId) {
  return actor.getJobIncentivePool(jobId);
}
export async function apiGetAllIncentiveLedger(actor: ActorType) {
  return actor.getAllIncentiveLedger();
}
export async function apiGetWorkerLedger(actor: ActorType, workerId: WorkerId) {
  return actor.getWorkerLedger(workerId);
}
export async function apiGetPendingIncentives(actor: ActorType) {
  return actor.getPendingIncentives();
}
export async function apiDistributeIncentive(
  actor: ActorType,
  jobId: JobId,
  primaryWorker: WorkerId,
  assistEntries: Array<{ workerId: WorkerId; trackedNanos: bigint }>,
  elapsedNanos: bigint,
  estimatedHours: bigint,
) {
  return actor.distributeJobIncentive(
    jobId,
    primaryWorker,
    assistEntries,
    elapsedNanos,
    estimatedHours,
  );
}

export async function apiImportAttendance(
  actor: ActorType,
  input: ImportAttendanceInput,
) {
  return actor.importAttendance(input);
}
export async function apiQueryAttendance(
  actor: ActorType,
  filter: AttendanceFilter,
) {
  return actor.queryAttendance(filter);
}
export async function apiGetMonthlyAttendanceSummary(
  actor: ActorType,
  workerId: WorkerId,
  month: string,
) {
  return actor.getMonthlyAttendanceSummary(workerId, month);
}
export async function apiSetBiometricMapping(
  actor: ActorType,
  biometricEmployeeId: string,
  workerId: WorkerId,
) {
  return actor.setBiometricMapping(biometricEmployeeId, workerId);
}
export async function apiListBiometricMappings(actor: ActorType) {
  return actor.listBiometricMappings();
}

export async function apiGetMyNotifications(
  actor: ActorType,
  role: RecipientRole,
) {
  return actor.getMyNotifications(role);
}
export async function apiGetUnreadCount(actor: ActorType, role: RecipientRole) {
  return actor.getUnreadCount(role);
}
export async function apiMarkNotificationRead(
  actor: ActorType,
  id: NotificationId,
) {
  return actor.markNotificationRead(id);
}
export async function apiMarkAllNotificationsRead(
  actor: ActorType,
  role: RecipientRole,
) {
  return actor.markAllNotificationsRead(role);
}
export async function apiCreateNotification(
  actor: ActorType,
  input: CreateNotificationInput,
) {
  return actor.createNotification(input);
}
export async function apiListNotificationTemplates(actor: ActorType) {
  return actor.listNotificationTemplates();
}
export async function apiUpsertNotificationTemplate(
  actor: ActorType,
  input: UpsertTemplateInput,
) {
  return actor.upsertNotificationTemplate(input);
}
export async function apiGetTemplateForTrigger(
  actor: ActorType,
  trigger: NotificationTrigger,
) {
  return actor.getTemplateForTrigger(trigger);
}

export async function apiListActiveProducts(actor: ActorType) {
  return actor.listActiveProducts();
}
export async function apiCreateProduct(
  actor: ActorType,
  input: CreateProductInput,
) {
  return actor.createProduct(input);
}
export async function apiDeactivateProduct(actor: ActorType, id: ProductId) {
  return actor.deactivateProduct(id);
}
export async function apiBulkUpsertProducts(
  actor: ActorType,
  inputs: BulkUpsertProductInput[],
) {
  return actor.bulkUpsertProducts(inputs);
}

export async function apiGetSettings(actor: ActorType) {
  return actor.getSettings();
}
export async function apiUpdateSettings(
  actor: ActorType,
  input: UpdateSettingsInput,
) {
  return actor.updateSettings(input);
}

export async function apiQueryAuditLog(
  actor: ActorType,
  filter: AuditQueryFilter,
) {
  return actor.queryAuditLog(filter);
}

export async function apiGetCallerUserRole(actor: ActorType) {
  return actor.getCallerUserRole();
}
export async function apiIsCallerAdmin(actor: ActorType) {
  return actor.isCallerAdmin();
}
export async function apiAssignCallerUserRole(
  actor: ActorType,
  user: import("@icp-sdk/core/principal").Principal,
  role: import("../backend.d.ts").UserRole,
) {
  return actor.assignCallerUserRole(user, role);
}
