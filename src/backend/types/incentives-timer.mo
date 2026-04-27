import CommonTypes "common";

module {
  public type JobId    = CommonTypes.JobId;
  public type WorkerId = CommonTypes.WorkerId;
  public type Timestamp = CommonTypes.Timestamp;

  // ── Timer ─────────────────────────────────────────────────────────────────

  public type TimerState = {
    #running;
    #paused;
    #stopped;
  };

  /// Persisted timer record for a job — stored on backend so page refreshes
  /// never lose elapsed time.
  public type TimerRecord = {
    jobId                : JobId;
    var state            : TimerState;
    startedAt            : Timestamp;        // nanoseconds (Time.now())
    var totalPausedNanos : Nat;              // accumulated paused duration in ns
    var pausedAt         : ?Timestamp;       // set when paused, cleared on resume
  };

  /// Shared (API-boundary) projection of TimerRecord — no mutable fields.
  public type TimerRecordView = {
    jobId            : JobId;
    state            : TimerState;
    startedAt        : Timestamp;
    totalPausedNanos : Nat;
    pausedAt         : ?Timestamp;
    elapsedSeconds   : Nat;                  // pre-computed for convenience
  };

  // ── Worker Time Contribution ───────────────────────────────────────────────

  /// Tracks how many nanoseconds a single worker actively contributed to a job.
  public type WorkerTimeEntry = {
    workerId     : WorkerId;
    trackedNanos : Nat;                      // active (non-paused) ns for this worker
  };

  // ── Incentive Pool ────────────────────────────────────────────────────────

  public type IncentiveStatus = {
    #pending;
    #distributed;
  };

  /// Per-assist-worker share record inside an IncentivePool.
  public type AssistShare = {
    workerId : WorkerId;
    amount   : Nat;                          // in smallest currency unit (e.g. paise)
  };

  public type IncentivePool = {
    jobId                      : JobId;
    totalPool                  : Nat;        // project_price × pool_percent / 100
    var primaryWorkerShare     : Nat;
    var assistWorkerShares     : [AssistShare];
    var earlyBonus             : Nat;        // 0 if not applicable
    var status                 : IncentiveStatus;
    var distributedAt          : ?Timestamp;
  };

  /// Shared (API-boundary) projection — no mutable fields.
  public type IncentivePoolView = {
    jobId              : JobId;
    totalPool          : Nat;
    primaryWorkerShare : Nat;
    assistWorkerShares : [AssistShare];
    earlyBonus         : Nat;
    status             : IncentiveStatus;
    distributedAt      : ?Timestamp;
  };

  // ── Incentive Ledger ───────────────────────────────────────────────────────

  public type IncentiveLedgerEntry = {
    workerId      : WorkerId;
    jobId         : JobId;
    amount        : Nat;
    earlyBonus    : Bool;
    distributedAt : Timestamp;
  };

  // ── Config ─────────────────────────────────────────────────────────────────

  public type IncentiveTimerConfig = {
    var poolPercent          : Nat;          // e.g. 10 means 10%
    var idleThresholdMinutes : Nat;          // minutes before idle flag fires
  };
};
