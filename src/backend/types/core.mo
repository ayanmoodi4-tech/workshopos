import Common "common";

module {
  // ─── Worker ───────────────────────────────────────────────────────────────

  public type WorkerStatus = { #active; #inactive };

  public type Worker = {
    id : Common.WorkerId;
    name : Text;
    phone : Text;
    email : Text;
    biometricEmployeeId : ?Text;
    status : WorkerStatus;
    createdAt : Common.Timestamp;
    deactivatedAt : ?Common.Timestamp;
  };

  // ─── Job Card ─────────────────────────────────────────────────────────────

  public type JobPriority = { #low; #medium; #high };
  public type JobComplexity = Nat; // 1-5

  public type JobStatus = {
    #pendingAssignment;
    #inProgress;
    #paused;
    #completed;
    #cancelled;
  };

  public type JobStatusEntry = {
    status : JobStatus;
    timestamp : Common.Timestamp;
    changedBy : Principal;
    note : Text;
  };

  public type Job = {
    jobId : Common.JobId;
    customerName : Text;
    customerPhone : Text;
    carMake : Text;
    carModel : Text;
    carYear : Nat;
    carPlate : Text;
    description : Text;
    productIds : [Common.ProductId];
    complexity : JobComplexity;
    estimatedHours : Nat;
    priority : JobPriority;
    projectPrice : Nat;
    status : JobStatus;
    cancellationReason : ?Text;
    createdAt : Common.Timestamp;
    createdBy : Principal;
    statusHistory : [JobStatusEntry];
  };

  // ─── Product ─────────────────────────────────────────────────────────────

  public type Product = {
    id : Common.ProductId;
    name : Text;
    code : ?Text;
    notes : ?Text;
    active : Bool;
  };

  // ─── Assignment ───────────────────────────────────────────────────────────

  public type ReassignmentEntry = {
    fromWorkerId : Common.WorkerId;
    toWorkerId : Common.WorkerId;
    reason : Text;
    timestamp : Common.Timestamp;
    changedBy : Principal;
  };

  public type Assignment = {
    jobId : Common.JobId;
    primaryWorkerId : Common.WorkerId;
    assistWorkerIds : [Common.WorkerId];
    assignedAt : Common.Timestamp;
    assignedBy : Principal;
    reassignmentHistory : [ReassignmentEntry];
  };

  // ─── Audit Log ────────────────────────────────────────────────────────────

  public type AuditEntityType = {
    #job;
    #worker;
    #assignment;
    #product;
    #setting;
    #notification;
    #attendance;
    #incentive;
  };

  public type AuditEntry = {
    id : Common.AuditEntryId;
    entityType : AuditEntityType;
    entityId : Text;
    action : Text;
    actorPrincipal : Principal;
    timestamp : Common.Timestamp;
    details : Text;
  };

  // ─── Input types (for API boundaries) ────────────────────────────────────

  public type CreateWorkerInput = {
    name : Text;
    phone : Text;
    email : Text;
    biometricEmployeeId : ?Text;
  };

  public type UpdateWorkerInput = {
    id : Common.WorkerId;
    name : Text;
    phone : Text;
    email : Text;
    biometricEmployeeId : ?Text;
  };

  public type CreateJobInput = {
    customerName : Text;
    customerPhone : Text;
    carMake : Text;
    carModel : Text;
    carYear : Nat;
    carPlate : Text;
    description : Text;
    productIds : [Common.ProductId];
    complexity : JobComplexity;
    estimatedHours : Nat;
    priority : JobPriority;
    projectPrice : Nat;
  };

  public type UpdateJobInput = {
    jobId : Common.JobId;
    customerName : Text;
    customerPhone : Text;
    carMake : Text;
    carModel : Text;
    carYear : Nat;
    carPlate : Text;
    description : Text;
    productIds : [Common.ProductId];
    complexity : JobComplexity;
    estimatedHours : Nat;
    priority : JobPriority;
    projectPrice : Nat;
  };

  public type ChangeJobStatusInput = {
    jobId : Common.JobId;
    newStatus : JobStatus;
    note : Text;
  };

  public type CreateProductInput = {
    name : Text;
    code : ?Text;
    notes : ?Text;
  };

  public type BulkUpsertProductInput = {
    name : Text;
    code : ?Text;
    notes : ?Text;
  };

  public type AssignWorkersInput = {
    jobId : Common.JobId;
    primaryWorkerId : Common.WorkerId;
    assistWorkerIds : [Common.WorkerId];
  };

  public type ReassignWorkerInput = {
    jobId : Common.JobId;
    fromWorkerId : Common.WorkerId;
    toWorkerId : Common.WorkerId;
    reason : Text;
  };

  public type AuditQueryFilter = {
    entityType : ?AuditEntityType;
    entityId : ?Text;
    actorPrincipal : ?Principal;
    fromTime : ?Common.Timestamp;
    toTime : ?Common.Timestamp;
  };
};
