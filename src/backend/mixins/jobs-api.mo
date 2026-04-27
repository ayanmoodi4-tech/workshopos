import List "mo:core/List";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Types "../types/core";
import JobsLib "../lib/jobs";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  jobs : List.List<Types.Job>,
  assignments : Map.Map<Common.JobId, Types.Assignment>,
  auditLog : List.List<Types.AuditEntry>,
) {
  /// Create a new job card. SalesManager or Admin only.
  public shared ({ caller }) func createJob(input : Types.CreateJobInput) : async Types.Job {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: SalesManager or Admin only");
    };
    let now = Time.now();
    let date = timestampToDateStr(now);
    let jobId = JobsLib.generateJobId(date, jobs.size() + 1);
    let job = JobsLib.createJob(jobs, jobId, input, caller, now);
    ignore AuditLib.logAction(
      auditLog, auditLog.size() + 1, #job, jobId,
      "createJob", caller, now, "Created job: " # jobId,
    );
    job;
  };

  /// Update job card fields (not status). SalesManager or Admin only.
  public shared ({ caller }) func updateJob(input : Types.UpdateJobInput) : async ?Types.Job {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: SalesManager or Admin only");
    };
    let result = JobsLib.updateJob(jobs, input);
    let now = Time.now();
    switch (result) {
      case (?_) {
        ignore AuditLib.logAction(
          auditLog, auditLog.size() + 1, #job, input.jobId,
          "updateJob", caller, now, "Updated job",
        );
      };
      case null ();
    };
    result;
  };

  /// Change job status; cancellation requires a reason in the note field.
  public shared ({ caller }) func changeJobStatus(input : Types.ChangeJobStatusInput) : async ?Types.Job {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    // Cancellation requires a reason
    switch (input.newStatus) {
      case (#cancelled) {
        if (input.note == "") Runtime.trap("Cancellation requires a reason in the note field");
      };
      case _ ();
    };
    let now = Time.now();
    let result = JobsLib.changeJobStatus(jobs, input, caller, now);
    switch (result) {
      case (?_) {
        ignore AuditLib.logAction(
          auditLog, auditLog.size() + 1, #job, input.jobId,
          "changeJobStatus", caller, now, "Status changed to: " # debug_show(input.newStatus),
        );
      };
      case null ();
    };
    result;
  };

  /// Get a single job by jobId.
  public query func getJob(jobId : Common.JobId) : async ?Types.Job {
    JobsLib.getJob(jobs, jobId);
  };

  /// List all jobs.
  public query func listAllJobs() : async [Types.Job] {
    JobsLib.listAllJobs(jobs);
  };

  /// List jobs filtered by status.
  public query func listJobsByStatus(status : Types.JobStatus) : async [Types.Job] {
    JobsLib.listJobsByStatus(jobs, status);
  };

  /// List jobs assigned to a specific worker.
  public query func listJobsByWorker(workerId : Common.WorkerId) : async [Types.Job] {
    JobsLib.listJobsByWorker(jobs, assignments, workerId);
  };

  /// Check if a job is overdue based on estimatedHours vs current time.
  public query func isJobOverdue(jobId : Common.JobId) : async ?Bool {
    switch (JobsLib.getJob(jobs, jobId)) {
      case null null;
      case (?job) {
        let now = Time.now();
        ?JobsLib.isOverdue(job, now);
      };
    };
  };

  /// Convert nanosecond timestamp to YYYY-MM-DD string.
  func timestampToDateStr(ns : Int) : Text {
    let secs : Int = ns / 1_000_000_000;
    let days : Int = secs / 86400;
    let z = days + 719468;
    let era = (if (z >= 0) z else z - 146096) / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) mp + 3 else mp - 9;
    let yr = if (m <= 2) y + 1 else y;
    intPad(yr, 4) # intPad(m, 2) # intPad(d, 2);
  };

  func intPad(n : Int, width : Nat) : Text {
    let s = if (n >= 0) n.toText() else n.toText();
    let len = s.size();
    if (len >= width) s
    else {
      var pad = "";
      var i = len;
      while (i < width) { pad #= "0"; i += 1 };
      pad # s;
    };
  };
};
