import Common "../types/common";
import T "../types/attendance-notifications";
import Lib "../lib/attendance-notifications";
import List "mo:core/List";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";

mixin (
  accessControlState : AccessControl.AccessControlState,
  attendanceRecords : List.List<T.AttendanceRecord>,
  notifications : List.List<T.NotificationRecord>,
  notificationTemplates : List.List<T.NotificationTemplate>,
  biometricMapping : Map.Map<Text, Common.WorkerId>,
  settingsStore : T.AppSettingsStore,
) {

  // ─── Attendance ───────────────────────────────────────────────────────────

  /// Import biometric attendance records from CSV-parsed input.
  public shared ({ caller }) func importAttendance(
    input : T.ImportAttendanceInput
  ) : async Nat {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    let count = Lib.importAttendance(
      attendanceRecords, attendanceRecords.size() + 1, input,
      biometricMapping, settingsStore.settings.lateThresholdMinutes, now,
    );
    count;
  };

  /// Query attendance records with optional filters.
  public query func queryAttendance(
    filter : T.AttendanceFilter
  ) : async [T.AttendanceRecord] {
    Lib.queryAttendance(attendanceRecords, filter);
  };

  /// Get monthly attendance summary for a worker.
  public query func getMonthlyAttendanceSummary(
    workerId : Common.WorkerId,
    month : Text,
  ) : async T.AttendanceSummary {
    Lib.monthlySummary(attendanceRecords, workerId, month);
  };

  /// Set the biometric employee ID → worker mapping.
  public shared ({ caller }) func setBiometricMapping(
    biometricEmployeeId : Text,
    workerId : Common.WorkerId,
  ) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    Lib.setBiometricMapping(biometricMapping, biometricEmployeeId, workerId);
  };

  /// List all biometric mappings.
  public query func listBiometricMappings() : async [(Text, Common.WorkerId)] {
    Lib.listBiometricMappings(biometricMapping);
  };

  // ─── Notifications ────────────────────────────────────────────────────────

  /// Create a new in-app notification (called by other domain modules).
  public shared ({ caller }) func createNotification(
    input : T.CreateNotificationInput
  ) : async T.NotificationId {
    if (not AccessControl.hasPermission(accessControlState, caller, #user) and
        not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    let now = Time.now();
    Lib.createNotification(notifications, notifications.size() + 1, input, now);
  };

  /// Get notifications visible to the caller based on their role.
  public query ({ caller }) func getMyNotifications(
    role : T.RecipientRole
  ) : async [T.NotificationRecord] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user) and
        not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    Lib.getNotificationsForPrincipal(notifications, caller, role);
  };

  /// Mark a single notification as read.
  public shared ({ caller }) func markNotificationRead(
    notificationId : T.NotificationId
  ) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user) and
        not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    Lib.markAsRead(notifications, notificationId, caller);
  };

  /// Mark all notifications for the caller/role as read.
  public shared ({ caller }) func markAllNotificationsRead(
    role : T.RecipientRole
  ) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user) and
        not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    Lib.markAllRead(notifications, caller, role);
  };

  /// Get the unread notification count for the caller/role.
  public query ({ caller }) func getUnreadCount(
    role : T.RecipientRole
  ) : async Nat {
    if (not AccessControl.hasPermission(accessControlState, caller, #user) and
        not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    Lib.unreadCount(notifications, caller, role);
  };

  // ─── Notification Templates ───────────────────────────────────────────────

  /// Upsert a notification template (Admin only).
  public shared ({ caller }) func upsertNotificationTemplate(
    input : T.UpsertTemplateInput
  ) : async T.TemplateId {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let now = Time.now();
    Lib.upsertTemplate(notificationTemplates, notificationTemplates.size() + 1, input, caller, now);
  };

  /// List all notification templates.
  public query func listNotificationTemplates() : async [T.NotificationTemplate] {
    Lib.listTemplates(notificationTemplates);
  };

  /// Get the active template for a specific trigger.
  public query func getTemplateForTrigger(
    trigger : T.NotificationTrigger
  ) : async ?T.NotificationTemplate {
    Lib.getTemplateForTrigger(notificationTemplates, trigger);
  };

  // ─── Admin Settings ───────────────────────────────────────────────────────

  /// Get the current application settings.
  public query func getSettings() : async T.AppSettings {
    Lib.getSettings(settingsStore.settings);
  };

  /// Update application settings (Admin only).
  public shared ({ caller }) func updateSettings(
    input : T.UpdateSettingsInput
  ) : async T.AppSettings {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let newSettings = Lib.updateSettings(settingsStore.settings, input);
    settingsStore.settings := newSettings;
    newSettings;
  };
};
