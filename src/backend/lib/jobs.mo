import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Common "../types/common";
import Types "../types/core";

module {
  // Nanoseconds per hour
  let NANOS_PER_HOUR : Int = 3_600_000_000_000;

  public func generateJobId(date : Text, sequence : Nat) : Common.JobId {
    let seqStr = sequence.toText();
    let padded = if (sequence < 10) "00" # seqStr
      else if (sequence < 100) "0" # seqStr
      else seqStr;
    "JOB-" # date # "-" # padded;
  };

  public func createJob(
    jobs : List.List<Types.Job>,
    jobId : Common.JobId,
    input : Types.CreateJobInput,
    createdBy : Principal,
    now : Common.Timestamp,
  ) : Types.Job {
    let initialStatus : Types.JobStatus = #pendingAssignment;
    let initialEntry : Types.JobStatusEntry = {
      status = initialStatus;
      timestamp = now;
      changedBy = createdBy;
      note = "Job created";
    };
    let job : Types.Job = {
      jobId;
      customerName = input.customerName;
      customerPhone = input.customerPhone;
      carMake = input.carMake;
      carModel = input.carModel;
      carYear = input.carYear;
      carPlate = input.carPlate;
      description = input.description;
      productIds = input.productIds;
      complexity = input.complexity;
      estimatedHours = input.estimatedHours;
      priority = input.priority;
      projectPrice = input.projectPrice;
      status = initialStatus;
      cancellationReason = null;
      createdAt = now;
      createdBy;
      statusHistory = [initialEntry];
    };
    jobs.add(job);
    job;
  };

  public func updateJob(
    jobs : List.List<Types.Job>,
    input : Types.UpdateJobInput,
  ) : ?Types.Job {
    var updated : ?Types.Job = null;
    jobs.mapInPlace(func(j) {
      if (j.jobId == input.jobId) {
        let newJob : Types.Job = {
          j with
          customerName = input.customerName;
          customerPhone = input.customerPhone;
          carMake = input.carMake;
          carModel = input.carModel;
          carYear = input.carYear;
          carPlate = input.carPlate;
          description = input.description;
          productIds = input.productIds;
          complexity = input.complexity;
          estimatedHours = input.estimatedHours;
          priority = input.priority;
          projectPrice = input.projectPrice;
        };
        updated := ?newJob;
        newJob;
      } else j;
    });
    updated;
  };

  public func changeJobStatus(
    jobs : List.List<Types.Job>,
    input : Types.ChangeJobStatusInput,
    changedBy : Principal,
    now : Common.Timestamp,
  ) : ?Types.Job {
    var updated : ?Types.Job = null;
    jobs.mapInPlace(func(j) {
      if (j.jobId == input.jobId) {
        let newEntry : Types.JobStatusEntry = {
          status = input.newStatus;
          timestamp = now;
          changedBy;
          note = input.note;
        };
        let cancellationReason = switch (input.newStatus) {
          case (#cancelled) if (input.note != "") ?input.note else j.cancellationReason;
          case _ j.cancellationReason;
        };
        let newJob : Types.Job = {
          j with
          status = input.newStatus;
          cancellationReason;
          statusHistory = j.statusHistory.concat([newEntry]);
        };
        updated := ?newJob;
        newJob;
      } else j;
    });
    updated;
  };

  public func getJob(
    jobs : List.List<Types.Job>,
    jobId : Common.JobId,
  ) : ?Types.Job {
    jobs.find(func(j) { j.jobId == jobId });
  };

  public func listAllJobs(jobs : List.List<Types.Job>) : [Types.Job] {
    jobs.toArray();
  };

  public func listJobsByStatus(
    jobs : List.List<Types.Job>,
    status : Types.JobStatus,
  ) : [Types.Job] {
    jobs.filter(func(j) { j.status == status }).toArray();
  };

  public func listJobsByWorker(
    jobs : List.List<Types.Job>,
    assignments : Map.Map<Common.JobId, Types.Assignment>,
    workerId : Common.WorkerId,
  ) : [Types.Job] {
    jobs.filter(func(j) {
      switch (assignments.get(j.jobId)) {
        case null false;
        case (?a) {
          if (a.primaryWorkerId == workerId) return true;
          switch (a.assistWorkerIds.find(func(id) { id == workerId })) {
            case null false;
            case _ true;
          };
        };
      };
    }).toArray();
  };

  public func isOverdue(job : Types.Job, now : Common.Timestamp) : Bool {
    if (job.status != #inProgress) return false;
    // Find when inProgress started (most recent inProgress entry)
    var startTime : ?Common.Timestamp = null;
    for (entry in job.statusHistory.values()) {
      switch (entry.status) {
        case (#inProgress) startTime := ?entry.timestamp;
        case _ ();
      };
    };
    switch (startTime) {
      case null false;
      case (?t) {
        let estimatedNanos : Int = job.estimatedHours.toInt() * NANOS_PER_HOUR;
        (now - t) > estimatedNanos;
      };
    };
  };
};
