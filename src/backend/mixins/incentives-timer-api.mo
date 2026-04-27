import Map     "mo:core/Map";
import List    "mo:core/List";
import Time    "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Types   "../types/incentives-timer";
import Lib     "../lib/incentives-timer";

mixin (
  accessControlState : AccessControl.AccessControlState,
  timers  : Map.Map<Types.JobId, Types.TimerRecord>,
  pools   : Map.Map<Types.JobId, Types.IncentivePool>,
  ledger  : List.List<Types.IncentiveLedgerEntry>,
  config  : Types.IncentiveTimerConfig,
) {
  // ── Timer API ─────────────────────────────────────────────────────────────

  /// Start timer for a job. WorkshopManager or Admin only.
  public shared ({ caller }) func startJobTimer(jobId : Types.JobId) : async Types.TimerRecordView {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    let record = Lib.startTimer(timers, jobId, now);
    {
      jobId = record.jobId;
      state = record.state;
      startedAt = record.startedAt;
      totalPausedNanos = record.totalPausedNanos;
      pausedAt = record.pausedAt;
      elapsedSeconds = 0;
    };
  };

  /// Pause a running job timer.
  public shared ({ caller }) func pauseJobTimer(jobId : Types.JobId) : async Types.TimerRecordView {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    Lib.pauseTimer(timers, jobId, now);
    switch (Lib.getTimerView(timers, jobId, now)) {
      case null Runtime.trap("Timer not found after pause");
      case (?v) v;
    };
  };

  /// Resume a paused job timer.
  public shared ({ caller }) func resumeJobTimer(jobId : Types.JobId) : async Types.TimerRecordView {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    Lib.resumeTimer(timers, jobId, now);
    switch (Lib.getTimerView(timers, jobId, now)) {
      case null Runtime.trap("Timer not found after resume");
      case (?v) v;
    };
  };

  /// Stop a job timer on completion.
  public shared ({ caller }) func stopJobTimer(jobId : Types.JobId) : async Types.TimerRecordView {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    let now = Time.now();
    Lib.stopTimer(timers, jobId, now);
    switch (Lib.getTimerView(timers, jobId, now)) {
      case null Runtime.trap("Timer not found after stop");
      case (?v) v;
    };
  };

  /// Get the current timer state for a job.
  public query func getJobTimerState(jobId : Types.JobId) : async ?Types.TimerRecordView {
    let now = Time.now();
    Lib.getTimerView(timers, jobId, now);
  };

  /// Return all job IDs currently flagged as idle.
  public query func getIdleJobs() : async [Types.JobId] {
    let now = Time.now();
    Lib.getIdleJobIds(timers, now, config.idleThresholdMinutes);
  };

  // ── Incentive API ─────────────────────────────────────────────────────────

  /// Create an incentive pool for a completed job.
  public shared ({ caller }) func createJobIncentivePool(
    jobId          : Types.JobId,
    projectPrice   : Nat,
    elapsedNanos   : Nat,
    estimatedHours : Nat,
  ) : async ?Types.IncentivePoolView {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: WorkshopManager or Admin only");
    };
    switch (Lib.createIncentivePool(pools, jobId, projectPrice, config.poolPercent, elapsedNanos, estimatedHours)) {
      case null null;
      case (?pool) {
        ?{
          jobId = pool.jobId;
          totalPool = pool.totalPool;
          primaryWorkerShare = pool.primaryWorkerShare;
          assistWorkerShares = pool.assistWorkerShares;
          earlyBonus = pool.earlyBonus;
          status = pool.status;
          distributedAt = pool.distributedAt;
        };
      };
    };
  };

  /// Distribute the incentive pool for a job to primary + assist workers.
  public shared ({ caller }) func distributeJobIncentive(
    jobId          : Types.JobId,
    primaryWorker  : Types.WorkerId,
    assistEntries  : [Types.WorkerTimeEntry],
    elapsedNanos   : Nat,
    estimatedHours : Nat,
  ) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let now = Time.now();
    Lib.distributeIncentive(pools, ledger, jobId, primaryWorker, assistEntries, elapsedNanos, estimatedHours, now);
  };

  /// Get all incentive ledger entries for a worker.
  public query func getWorkerLedger(workerId : Types.WorkerId) : async [Types.IncentiveLedgerEntry] {
    Lib.getLedgerByWorker(ledger, workerId);
  };

  /// Get all ledger entries (payroll export).
  public query func getAllIncentiveLedger() : async [Types.IncentiveLedgerEntry] {
    Lib.getAllLedgerEntries(ledger);
  };

  /// Get all pending incentive pools (completed jobs awaiting distribution).
  public query func getPendingIncentives() : async [Types.IncentivePoolView] {
    Lib.getPendingIncentivePools(pools);
  };

  /// Get the incentive pool view for a specific job.
  public query func getJobIncentivePool(jobId : Types.JobId) : async ?Types.IncentivePoolView {
    Lib.getIncentivePoolView(pools, jobId);
  };

  // ── Config API ────────────────────────────────────────────────────────────

  /// Update the incentive pool percentage (e.g. 10 = 10%). Admin only.
  public shared ({ caller }) func setPoolPercent(percent : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    config.poolPercent := percent;
  };

  /// Update the idle detection threshold (minutes). Admin only.
  public shared ({ caller }) func setIdleThresholdMinutes(minutes : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    config.idleThresholdMinutes := minutes;
  };
};
