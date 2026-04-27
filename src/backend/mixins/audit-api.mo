import List "mo:core/List";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Types "../types/core";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  auditLog : List.List<Types.AuditEntry>,
) {
  /// Query audit log entries with optional filters. Admin only.
  public query ({ caller }) func queryAuditLog(filter : Types.AuditQueryFilter) : async [Types.AuditEntry] {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    AuditLib.queryAuditLog(auditLog, filter);
  };
};
