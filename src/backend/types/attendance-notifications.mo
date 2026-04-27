import Common "common";

module {
  // ─── Shared IDs ───────────────────────────────────────────────────────────

  public type AttendanceId = Nat;
  public type NotificationId = Nat;
  public type TemplateId = Nat;
  public type ImportBatchId = Text;

  // ─── Roles ────────────────────────────────────────────────────────────────

  public type RecipientRole = {
    #admin;
    #salesManager;
    #workshopManager;
    #all;
  };

  // ─── Notification Triggers ────────────────────────────────────────────────

  public type NotificationTrigger = {
    #job_created;
    #status_changed;
    #overdue;
    #worker_idle;
    #job_completed;
    #attendance_anomaly;
    #incentive_awarded;
  };

  // ─── Attendance ───────────────────────────────────────────────────────────

  public type BiometricEvent = { #checkIn; #checkOut };

  public type BiometricRawRecord = {
    biometricEmployeeId : Text;
    eventTimestamp : Common.Timestamp; // nanos
    event : BiometricEvent;
  };

  public type AttendanceRecord = {
    id : AttendanceId;
    workerId : Common.WorkerId;
    biometricEmployeeId : Text;
    date : Text; // ISO date: YYYY-MM-DD
    checkInAt : ?Common.Timestamp;
    checkOutAt : ?Common.Timestamp;
    isLate : Bool;
    isAbsent : Bool;
    importedAt : Common.Timestamp;
    importBatchId : ImportBatchId;
  };

  public type AttendanceSummary = {
    workerId : Common.WorkerId;
    month : Text; // YYYY-MM
    daysPresent : Nat;
    daysLate : Nat;
    daysAbsent : Nat;
  };

  public type ImportAttendanceInput = {
    batchId : ImportBatchId;
    records : [BiometricRawRecord];
  };

  public type AttendanceFilter = {
    workerId : ?Common.WorkerId;
    fromDate : ?Text;
    toDate : ?Text;
    isLate : ?Bool;
    isAbsent : ?Bool;
  };

  // ─── Notifications ────────────────────────────────────────────────────────

  public type NotificationRecord = {
    id : NotificationId;
    recipientRole : RecipientRole;
    trigger : NotificationTrigger;
    title : Text;
    message : Text;
    entityId : ?Text; // jobId or workerId as text
    readBy : [Principal]; // principals who have read this
    createdAt : Common.Timestamp;
  };

  public type CreateNotificationInput = {
    recipientRole : RecipientRole;
    trigger : NotificationTrigger;
    title : Text;
    message : Text;
    entityId : ?Text;
  };

  public type NotificationTemplate = {
    id : TemplateId;
    trigger : NotificationTrigger;
    titleTemplate : Text;
    messageTemplate : Text;
    active : Bool;
    updatedAt : Common.Timestamp;
    updatedBy : Principal;
  };

  public type UpsertTemplateInput = {
    trigger : NotificationTrigger;
    titleTemplate : Text;
    messageTemplate : Text;
    active : Bool;
  };

  // ─── Admin Settings ───────────────────────────────────────────────────────

  public type AppSettings = {
    incentivePoolPercent : Nat;          // default 5
    lateThresholdMinutes : Nat;          // minutes since midnight, default 480 (8:00 AM)
    absentFlagDays : Nat;               // consecutive absent days before flag, default 1
    idleDetectionMinutes : Nat;          // default 15
    overdueAlertOffsetHours : Nat;       // default 1
    earlyBonusThresholdPercent : Nat;    // default 90
  };

  /// Mutable wrapper so mixin can update settings in-place.
  public type AppSettingsStore = {
    var settings : AppSettings;
  };

  public type UpdateSettingsInput = {
    incentivePoolPercent : ?Nat;
    lateThresholdMinutes : ?Nat;
    absentFlagDays : ?Nat;
    idleDetectionMinutes : ?Nat;
    overdueAlertOffsetHours : ?Nat;
    earlyBonusThresholdPercent : ?Nat;
  };
};
