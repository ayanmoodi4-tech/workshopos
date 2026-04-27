import List "mo:core/List";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Types "../types/core";
import AssignmentsLib "../lib/assignments";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  assignments : Map.Map<Common.JobId, Types.Assignment>,
  auditLog : List.List<Types.AuditEntry>,
) {
  /// Assign primary and assist workers to a job. WorkshopManager or Admin only.
  public shared ({ caller }) func assignWorkers(input : Types.AssignWorkersInput) : async Types.Assignment {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    let assignment = AssignmentsLib.assignWorkers(assignments, input, caller, now);
    ignore AuditLib.logAction(
      auditLog, auditLog.size() + 1, #assignment, input.jobId,
      "assignWorkers", caller, now,
      "Assigned primary worker " # input.primaryWorkerId.toText() # " to job",
    );
    assignment;
  };

  /// Reassign the primary worker for a job. WorkshopManager or Admin only.
  public shared ({ caller }) func reassignPrimaryWorker(input : Types.ReassignWorkerInput) : async ?Types.Assignment {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    let result = AssignmentsLib.reassignPrimaryWorker(assignments, input, caller, now);
    switch (result) {
      case (?_) {
        ignore AuditLib.logAction(
          auditLog, auditLog.size() + 1, #assignment, input.jobId,
          "reassignPrimaryWorker", caller, now,
          "Reassigned primary from " # input.fromWorkerId.toText() # " to " # input.toWorkerId.toText(),
        );
      };
      case null ();
    };
    result;
  };

  /// Reassign an assist worker for a job. WorkshopManager or Admin only.
  public shared ({ caller }) func reassignAssistWorker(input : Types.ReassignWorkerInput) : async ?Types.Assignment {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    let result = AssignmentsLib.reassignAssistWorker(assignments, input, caller, now);
    switch (result) {
      case (?_) {
        ignore AuditLib.logAction(
          auditLog, auditLog.size() + 1, #assignment, input.jobId,
          "reassignAssistWorker", caller, now,
          "Reassigned assist from " # input.fromWorkerId.toText() # " to " # input.toWorkerId.toText(),
        );
      };
      case null ();
    };
    result;
  };

  /// Get the current assignment for a job.
  public query func getAssignment(jobId : Common.JobId) : async ?Types.Assignment {
    AssignmentsLib.getAssignment(assignments, jobId);
  };
};
