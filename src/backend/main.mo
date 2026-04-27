import List "mo:core/List";
import Map "mo:core/Map";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Common "types/common";
import Types "types/core";
import ITTypes "types/incentives-timer";
import ANTypes "types/attendance-notifications";
import WorkersApi "mixins/workers-api";
import JobsApi "mixins/jobs-api";
import ProductsApi "mixins/products-api";
import AssignmentsApi "mixins/assignments-api";
import AuditApi "mixins/audit-api";
import IncentivesTimerApi "mixins/incentives-timer-api";
import AttendanceNotificationsApi "mixins/attendance-notifications-api";
import ANLib "lib/attendance-notifications";

actor {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ─── Core State ───────────────────────────────────────────────────────────
  let workers = List.empty<Types.Worker>();

  let jobs = List.empty<Types.Job>();

  let products = List.empty<Types.Product>();

  let assignments = Map.empty<Common.JobId, Types.Assignment>();

  let auditLog = List.empty<Types.AuditEntry>();

  // ─── Incentives & Timer State ─────────────────────────────────────────────
  let timers = Map.empty<ITTypes.JobId, ITTypes.TimerRecord>();
  let incentivePools = Map.empty<ITTypes.JobId, ITTypes.IncentivePool>();
  let incentiveLedger = List.empty<ITTypes.IncentiveLedgerEntry>();
  let incentiveTimerConfig : ITTypes.IncentiveTimerConfig = {
    var poolPercent = 5;
    var idleThresholdMinutes = 15;
  };

  // ─── Attendance & Notifications State ─────────────────────────────────────
  let attendanceRecords = List.empty<ANTypes.AttendanceRecord>();
  let notificationsList = List.empty<ANTypes.NotificationRecord>();
  let notificationTemplates = List.empty<ANTypes.NotificationTemplate>();
  let biometricMapping = Map.empty<Text, Common.WorkerId>();
  let settingsStore : ANTypes.AppSettingsStore = { var settings = ANLib.defaultSettings() };

  // ─── Mixins ───────────────────────────────────────────────────────────────
  include WorkersApi(accessControlState, workers, auditLog);
  include JobsApi(accessControlState, jobs, assignments, auditLog);
  include ProductsApi(accessControlState, products, auditLog);
  include AssignmentsApi(accessControlState, assignments, auditLog);
  include AuditApi(accessControlState, auditLog);
  include IncentivesTimerApi(accessControlState, timers, incentivePools, incentiveLedger, incentiveTimerConfig);
  include AttendanceNotificationsApi(
    accessControlState,
    attendanceRecords,
    notificationsList,
    notificationTemplates,
    biometricMapping,
    settingsStore,
  );
};
