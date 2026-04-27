import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TimerRecordView {
    totalPausedNanos: bigint;
    pausedAt?: Timestamp;
    startedAt: Timestamp;
    jobId: JobId;
    state: TimerState;
    elapsedSeconds: bigint;
}
export interface JobStatusEntry {
    status: JobStatus;
    changedBy: Principal;
    note: string;
    timestamp: Timestamp;
}
export type Timestamp = bigint;
export interface CreateWorkerInput {
    name: string;
    email: string;
    biometricEmployeeId?: string;
    phone: string;
}
export interface CreateJobInput {
    customerName: string;
    complexity: JobComplexity;
    carModel: string;
    customerPhone: string;
    productIds: Array<ProductId>;
    projectPrice: bigint;
    description: string;
    estimatedHours: bigint;
    carMake: string;
    priority: JobPriority;
    carYear: bigint;
    carPlate: string;
}
export type AuditEntryId = bigint;
export interface AttendanceFilter {
    workerId?: WorkerId;
    isLate?: boolean;
    toDate?: string;
    fromDate?: string;
    isAbsent?: boolean;
}
export type TemplateId = bigint;
export interface IncentiveLedgerEntry {
    workerId: WorkerId;
    jobId: JobId;
    distributedAt: Timestamp;
    earlyBonus: boolean;
    amount: bigint;
}
export interface WorkerTimeEntry {
    workerId: WorkerId;
    trackedNanos: bigint;
}
export interface AuditEntry {
    id: AuditEntryId;
    action: string;
    entityId: string;
    timestamp: Timestamp;
    details: string;
    actorPrincipal: Principal;
    entityType: AuditEntityType;
}
export type AttendanceId = bigint;
export interface AssignWorkersInput {
    jobId: JobId;
    assistWorkerIds: Array<WorkerId>;
    primaryWorkerId: WorkerId;
}
export interface NotificationRecord {
    id: NotificationId;
    title: string;
    trigger: NotificationTrigger;
    createdAt: Timestamp;
    entityId?: string;
    message: string;
    recipientRole: RecipientRole;
    readBy: Array<Principal>;
}
export interface Job {
    customerName: string;
    complexity: JobComplexity;
    status: JobStatus;
    carModel: string;
    customerPhone: string;
    productIds: Array<ProductId>;
    cancellationReason?: string;
    projectPrice: bigint;
    createdAt: Timestamp;
    createdBy: Principal;
    jobId: JobId;
    description: string;
    statusHistory: Array<JobStatusEntry>;
    estimatedHours: bigint;
    carMake: string;
    priority: JobPriority;
    carYear: bigint;
    carPlate: string;
}
export type ImportBatchId = string;
export interface UpdateSettingsInput {
    overdueAlertOffsetHours?: bigint;
    earlyBonusThresholdPercent?: bigint;
    incentivePoolPercent?: bigint;
    absentFlagDays?: bigint;
    idleDetectionMinutes?: bigint;
    lateThresholdMinutes?: bigint;
}
export interface NotificationTemplate {
    id: TemplateId;
    messageTemplate: string;
    active: boolean;
    trigger: NotificationTrigger;
    updatedAt: Timestamp;
    updatedBy: Principal;
    titleTemplate: string;
}
export interface ReassignWorkerInput {
    jobId: JobId;
    toWorkerId: WorkerId;
    fromWorkerId: WorkerId;
    reason: string;
}
export interface Assignment {
    assignedAt: Timestamp;
    assignedBy: Principal;
    reassignmentHistory: Array<ReassignmentEntry>;
    jobId: JobId;
    assistWorkerIds: Array<WorkerId>;
    primaryWorkerId: WorkerId;
}
export interface AuditQueryFilter {
    toTime?: Timestamp;
    entityId?: string;
    fromTime?: Timestamp;
    actorPrincipal?: Principal;
    entityType?: AuditEntityType;
}
export interface AttendanceRecord {
    id: AttendanceId;
    workerId: WorkerId;
    date: string;
    checkOutAt?: Timestamp;
    importedAt: Timestamp;
    isLate: boolean;
    biometricEmployeeId: string;
    checkInAt?: Timestamp;
    importBatchId: ImportBatchId;
    isAbsent: boolean;
}
export interface Worker {
    id: WorkerId;
    status: WorkerStatus;
    name: string;
    createdAt: Timestamp;
    deactivatedAt?: Timestamp;
    email: string;
    biometricEmployeeId?: string;
    phone: string;
}
export interface ImportAttendanceInput {
    records: Array<BiometricRawRecord>;
    batchId: ImportBatchId;
}
export interface UpdateJobInput {
    customerName: string;
    complexity: JobComplexity;
    carModel: string;
    customerPhone: string;
    productIds: Array<ProductId>;
    projectPrice: bigint;
    jobId: JobId;
    description: string;
    estimatedHours: bigint;
    carMake: string;
    priority: JobPriority;
    carYear: bigint;
    carPlate: string;
}
export interface UpsertTemplateInput {
    messageTemplate: string;
    active: boolean;
    trigger: NotificationTrigger;
    titleTemplate: string;
}
export interface IncentivePoolView {
    status: IncentiveStatus;
    jobId: JobId;
    distributedAt?: Timestamp;
    totalPool: bigint;
    primaryWorkerShare: bigint;
    earlyBonus: bigint;
    assistWorkerShares: Array<AssistShare>;
}
export type JobId = string;
export interface ChangeJobStatusInput {
    note: string;
    jobId: JobId;
    newStatus: JobStatus;
}
export interface ReassignmentEntry {
    changedBy: Principal;
    toWorkerId: WorkerId;
    timestamp: Timestamp;
    fromWorkerId: WorkerId;
    reason: string;
}
export interface UpdateWorkerInput {
    id: WorkerId;
    name: string;
    email: string;
    biometricEmployeeId?: string;
    phone: string;
}
export interface CreateProductInput {
    code?: string;
    name: string;
    notes?: string;
}
export interface BulkUpsertProductInput {
    code?: string;
    name: string;
    notes?: string;
}
export interface CreateNotificationInput {
    title: string;
    trigger: NotificationTrigger;
    entityId?: string;
    message: string;
    recipientRole: RecipientRole;
}
export interface BiometricRawRecord {
    biometricEmployeeId: string;
    event: BiometricEvent;
    eventTimestamp: Timestamp;
}
export interface AttendanceSummary {
    month: string;
    workerId: WorkerId;
    daysAbsent: bigint;
    daysPresent: bigint;
    daysLate: bigint;
}
export type JobComplexity = bigint;
export interface AppSettings {
    overdueAlertOffsetHours: bigint;
    earlyBonusThresholdPercent: bigint;
    incentivePoolPercent: bigint;
    absentFlagDays: bigint;
    idleDetectionMinutes: bigint;
    lateThresholdMinutes: bigint;
}
export type NotificationId = bigint;
export type WorkerId = bigint;
export type ProductId = bigint;
export interface AssistShare {
    workerId: WorkerId;
    amount: bigint;
}
export interface Product {
    id: ProductId;
    active: boolean;
    code?: string;
    name: string;
    notes?: string;
}
export enum AuditEntityType {
    job = "job",
    setting = "setting",
    assignment = "assignment",
    incentive = "incentive",
    notification = "notification",
    attendance = "attendance",
    worker = "worker",
    product = "product"
}
export enum BiometricEvent {
    checkIn = "checkIn",
    checkOut = "checkOut"
}
export enum IncentiveStatus {
    distributed = "distributed",
    pending = "pending"
}
export enum JobPriority {
    low = "low",
    high = "high",
    medium = "medium"
}
export enum JobStatus {
    cancelled = "cancelled",
    completed = "completed",
    pendingAssignment = "pendingAssignment",
    inProgress = "inProgress",
    paused = "paused"
}
export enum NotificationTrigger {
    status_changed = "status_changed",
    worker_idle = "worker_idle",
    attendance_anomaly = "attendance_anomaly",
    job_completed = "job_completed",
    overdue = "overdue",
    job_created = "job_created",
    incentive_awarded = "incentive_awarded"
}
export enum RecipientRole {
    all = "all",
    admin = "admin",
    salesManager = "salesManager",
    workshopManager = "workshopManager"
}
export enum TimerState {
    stopped = "stopped",
    running = "running",
    paused = "paused"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export enum WorkerStatus {
    active = "active",
    inactive = "inactive"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    assignWorkers(input: AssignWorkersInput): Promise<Assignment>;
    bulkUpsertProducts(inputs: Array<BulkUpsertProductInput>): Promise<bigint>;
    changeJobStatus(input: ChangeJobStatusInput): Promise<Job | null>;
    createJob(input: CreateJobInput): Promise<Job>;
    createJobIncentivePool(jobId: JobId, projectPrice: bigint, elapsedNanos: bigint, estimatedHours: bigint): Promise<IncentivePoolView | null>;
    createNotification(input: CreateNotificationInput): Promise<NotificationId>;
    createProduct(input: CreateProductInput): Promise<Product>;
    createWorker(input: CreateWorkerInput): Promise<Worker>;
    deactivateProduct(productId: ProductId): Promise<boolean>;
    deactivateWorker(workerId: WorkerId): Promise<boolean>;
    distributeJobIncentive(jobId: JobId, primaryWorker: WorkerId, assistEntries: Array<WorkerTimeEntry>, elapsedNanos: bigint, estimatedHours: bigint): Promise<void>;
    getAllIncentiveLedger(): Promise<Array<IncentiveLedgerEntry>>;
    getAssignment(jobId: JobId): Promise<Assignment | null>;
    getCallerUserRole(): Promise<UserRole>;
    getIdleJobs(): Promise<Array<JobId>>;
    getJob(jobId: JobId): Promise<Job | null>;
    getJobIncentivePool(jobId: JobId): Promise<IncentivePoolView | null>;
    getJobTimerState(jobId: JobId): Promise<TimerRecordView | null>;
    getMonthlyAttendanceSummary(workerId: WorkerId, month: string): Promise<AttendanceSummary>;
    getMyNotifications(role: RecipientRole): Promise<Array<NotificationRecord>>;
    getPendingIncentives(): Promise<Array<IncentivePoolView>>;
    getSettings(): Promise<AppSettings>;
    getTemplateForTrigger(trigger: NotificationTrigger): Promise<NotificationTemplate | null>;
    getUnreadCount(role: RecipientRole): Promise<bigint>;
    getWorker(workerId: WorkerId): Promise<Worker | null>;
    getWorkerLedger(workerId: WorkerId): Promise<Array<IncentiveLedgerEntry>>;
    importAttendance(input: ImportAttendanceInput): Promise<bigint>;
    isCallerAdmin(): Promise<boolean>;
    isJobOverdue(jobId: JobId): Promise<boolean | null>;
    listActiveProducts(): Promise<Array<Product>>;
    listAllJobs(): Promise<Array<Job>>;
    listBiometricMappings(): Promise<Array<[string, WorkerId]>>;
    listJobsByStatus(status: JobStatus): Promise<Array<Job>>;
    listJobsByWorker(workerId: WorkerId): Promise<Array<Job>>;
    listNotificationTemplates(): Promise<Array<NotificationTemplate>>;
    listWorkers(status: WorkerStatus | null): Promise<Array<Worker>>;
    markAllNotificationsRead(role: RecipientRole): Promise<void>;
    markNotificationRead(notificationId: NotificationId): Promise<void>;
    pauseJobTimer(jobId: JobId): Promise<TimerRecordView>;
    queryAttendance(filter: AttendanceFilter): Promise<Array<AttendanceRecord>>;
    queryAuditLog(filter: AuditQueryFilter): Promise<Array<AuditEntry>>;
    reassignAssistWorker(input: ReassignWorkerInput): Promise<Assignment | null>;
    reassignPrimaryWorker(input: ReassignWorkerInput): Promise<Assignment | null>;
    resumeJobTimer(jobId: JobId): Promise<TimerRecordView>;
    setBiometricMapping(biometricEmployeeId: string, workerId: WorkerId): Promise<void>;
    setIdleThresholdMinutes(minutes: bigint): Promise<void>;
    setPoolPercent(percent: bigint): Promise<void>;
    startJobTimer(jobId: JobId): Promise<TimerRecordView>;
    stopJobTimer(jobId: JobId): Promise<TimerRecordView>;
    updateJob(input: UpdateJobInput): Promise<Job | null>;
    updateSettings(input: UpdateSettingsInput): Promise<AppSettings>;
    updateWorker(input: UpdateWorkerInput): Promise<Worker | null>;
    upsertNotificationTemplate(input: UpsertTemplateInput): Promise<TemplateId>;
}
