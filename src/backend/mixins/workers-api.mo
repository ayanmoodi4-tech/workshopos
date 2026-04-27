import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Types "../types/core";
import WorkersLib "../lib/workers";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  workers : List.List<Types.Worker>,
  auditLog : List.List<Types.AuditEntry>,
) {
  /// Create a new worker profile. Admin or WorkshopManager only.
  public shared ({ caller }) func createWorker(input : Types.CreateWorkerInput) : async Types.Worker {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Admin or WorkshopManager only");
    };
    let now = Time.now();
    let (worker, _) = WorkersLib.createWorker(workers, workers.size() + 1, input, now);
    ignore AuditLib.logAction(
      auditLog, auditLog.size() + 1, #worker, worker.id.toText(),
      "createWorker", caller, now, "Created worker: " # input.name,
    );
    worker;
  };

  /// Update an existing worker's details. Admin or WorkshopManager only.
  public shared ({ caller }) func updateWorker(input : Types.UpdateWorkerInput) : async ?Types.Worker {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Admin or WorkshopManager only");
    };
    let result = WorkersLib.updateWorker(workers, input);
    let now = Time.now();
    switch (result) {
      case (?_) {
        ignore AuditLib.logAction(
          auditLog, auditLog.size() + 1, #worker, input.id.toText(),
          "updateWorker", caller, now, "Updated worker",
        );
      };
      case null ();
    };
    result;
  };

  /// Deactivate a worker (no delete). Admin only.
  public shared ({ caller }) func deactivateWorker(workerId : Common.WorkerId) : async Bool {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let now = Time.now();
    let result = WorkersLib.deactivateWorker(workers, workerId, now);
    if (result) {
      ignore AuditLib.logAction(
        auditLog, auditLog.size() + 1, #worker, workerId.toText(),
        "deactivateWorker", caller, now, "Deactivated worker",
      );
    };
    result;
  };

  /// Get a single worker by id.
  public query func getWorker(workerId : Common.WorkerId) : async ?Types.Worker {
    WorkersLib.getWorker(workers, workerId);
  };

  /// List workers, optionally filtered by status.
  public query func listWorkers(status : ?Types.WorkerStatus) : async [Types.Worker] {
    WorkersLib.listWorkersByStatus(workers, status);
  };
};
