import Map "mo:core/Map";
import Common "../types/common";
import Types "../types/core";

module {
  public func assignWorkers(
    assignments : Map.Map<Common.JobId, Types.Assignment>,
    input : Types.AssignWorkersInput,
    assignedBy : Principal,
    now : Common.Timestamp,
  ) : Types.Assignment {
    let assignment : Types.Assignment = {
      jobId = input.jobId;
      primaryWorkerId = input.primaryWorkerId;
      assistWorkerIds = input.assistWorkerIds;
      assignedAt = now;
      assignedBy;
      reassignmentHistory = [];
    };
    assignments.add(input.jobId, assignment);
    assignment;
  };

  public func reassignPrimaryWorker(
    assignments : Map.Map<Common.JobId, Types.Assignment>,
    input : Types.ReassignWorkerInput,
    changedBy : Principal,
    now : Common.Timestamp,
  ) : ?Types.Assignment {
    switch (assignments.get(input.jobId)) {
      case null null;
      case (?a) {
        let entry : Types.ReassignmentEntry = {
          fromWorkerId = input.fromWorkerId;
          toWorkerId = input.toWorkerId;
          reason = input.reason;
          timestamp = now;
          changedBy;
        };
        let updated : Types.Assignment = {
          a with
          primaryWorkerId = input.toWorkerId;
          reassignmentHistory = a.reassignmentHistory.concat([entry]);
        };
        assignments.add(input.jobId, updated);
        ?updated;
      };
    };
  };

  public func reassignAssistWorker(
    assignments : Map.Map<Common.JobId, Types.Assignment>,
    input : Types.ReassignWorkerInput,
    changedBy : Principal,
    now : Common.Timestamp,
  ) : ?Types.Assignment {
    switch (assignments.get(input.jobId)) {
      case null null;
      case (?a) {
        let entry : Types.ReassignmentEntry = {
          fromWorkerId = input.fromWorkerId;
          toWorkerId = input.toWorkerId;
          reason = input.reason;
          timestamp = now;
          changedBy;
        };
        let newAssists = a.assistWorkerIds.map(func(id : Common.WorkerId) : Common.WorkerId {
          if (id == input.fromWorkerId) input.toWorkerId else id;
        });
        let updated : Types.Assignment = {
          a with
          assistWorkerIds = newAssists;
          reassignmentHistory = a.reassignmentHistory.concat([entry]);
        };
        assignments.add(input.jobId, updated);
        ?updated;
      };
    };
  };

  public func getAssignment(
    assignments : Map.Map<Common.JobId, Types.Assignment>,
    jobId : Common.JobId,
  ) : ?Types.Assignment {
    assignments.get(jobId);
  };
};
