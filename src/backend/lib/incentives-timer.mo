import Map "mo:core/Map";
import List "mo:core/List";
import Runtime "mo:core/Runtime";
import Types "../types/incentives-timer";

module {
  let NANOS_PER_MINUTE : Nat = 60_000_000_000;
  let NANOS_PER_HOUR   : Nat = 3_600_000_000_000;

  // ── Timer operations ──────────────────────────────────────────────────────

  public func startTimer(
    timers  : Map.Map<Types.JobId, Types.TimerRecord>,
    jobId   : Types.JobId,
    now     : Types.Timestamp,
  ) : Types.TimerRecord {
    switch (timers.get(jobId)) {
      case (?_) Runtime.trap("Timer already exists for job: " # jobId);
      case null ();
    };
    let record : Types.TimerRecord = {
      jobId;
      var state = #running;
      startedAt = now;
      var totalPausedNanos = 0;
      var pausedAt = null;
    };
    timers.add(jobId, record);
    record;
  };

  public func pauseTimer(
    timers : Map.Map<Types.JobId, Types.TimerRecord>,
    jobId  : Types.JobId,
    now    : Types.Timestamp,
  ) : () {
    let record = switch (timers.get(jobId)) {
      case null Runtime.trap("No timer found for job: " # jobId);
      case (?r) r;
    };
    if (record.state != #running) {
      Runtime.trap("Timer is not running for job: " # jobId);
    };
    record.state := #paused;
    record.pausedAt := ?now;
  };

  public func resumeTimer(
    timers : Map.Map<Types.JobId, Types.TimerRecord>,
    jobId  : Types.JobId,
    now    : Types.Timestamp,
  ) : () {
    let record = switch (timers.get(jobId)) {
      case null Runtime.trap("No timer found for job: " # jobId);
      case (?r) r;
    };
    if (record.state != #paused) {
      Runtime.trap("Timer is not paused for job: " # jobId);
    };
    let pausedSince = switch (record.pausedAt) {
      case null 0;
      case (?t) {
        let diff : Int = now - t;
        if (diff > 0) diff.toNat() else 0;
      };
    };
    record.totalPausedNanos += pausedSince;
    record.pausedAt := null;
    record.state := #running;
  };

  public func stopTimer(
    timers : Map.Map<Types.JobId, Types.TimerRecord>,
    jobId  : Types.JobId,
    now    : Types.Timestamp,
  ) : () {
    let record = switch (timers.get(jobId)) {
      case null Runtime.trap("No timer found for job: " # jobId);
      case (?r) r;
    };
    if (record.state == #stopped) {
      Runtime.trap("Timer already stopped for job: " # jobId);
    };
    // If paused, accumulate paused time
    switch (record.pausedAt) {
      case (?t) {
        let diff : Int = now - t;
        if (diff > 0) record.totalPausedNanos += diff.toNat();
        record.pausedAt := null;
      };
      case null ();
    };
    record.state := #stopped;
  };

  public func getTimerView(
    timers : Map.Map<Types.JobId, Types.TimerRecord>,
    jobId  : Types.JobId,
    now    : Types.Timestamp,
  ) : ?Types.TimerRecordView {
    switch (timers.get(jobId)) {
      case null null;
      case (?r) {
        let elapsed = calcElapsedNanos(r, now);
        ?{
          jobId = r.jobId;
          state = r.state;
          startedAt = r.startedAt;
          totalPausedNanos = r.totalPausedNanos;
          pausedAt = r.pausedAt;
          elapsedSeconds = elapsed / 1_000_000_000;
        };
      };
    };
  };

  public func calcElapsedNanos(
    record : Types.TimerRecord,
    now    : Types.Timestamp,
  ) : Nat {
    let totalInt : Int = now - record.startedAt;
    let total : Nat = if (totalInt > 0) totalInt.toNat() else 0;
    let paused = record.totalPausedNanos;
    // If currently paused, add time since pausedAt
    let currentPaused = switch (record.pausedAt) {
      case null 0;
      case (?t) {
        let diff : Int = now - t;
        if (diff > 0) diff.toNat() else 0;
      };
    };
    let totalPaused = paused + currentPaused;
    if (total > totalPaused) total - totalPaused else 0;
  };

  public func getIdleJobIds(
    timers                : Map.Map<Types.JobId, Types.TimerRecord>,
    now                   : Types.Timestamp,
    idleThresholdMinutes  : Nat,
  ) : [Types.JobId] {
    let thresholdNanos = idleThresholdMinutes * NANOS_PER_MINUTE;
    var idle : [Types.JobId] = [];
    for ((jobId, record) in timers.entries()) {
      if (record.state == #running) {
        // Idle = running but no activity (elapsed time without pause changes)
        // We detect idle by checking if time since start (minus pauses) > threshold
        let elapsed = calcElapsedNanos(record, now);
        if (elapsed > thresholdNanos) {
          idle := idle.concat([jobId]);
        };
      };
    };
    idle;
  };

  // ── Incentive operations ──────────────────────────────────────────────────

  public func createIncentivePool(
    pools          : Map.Map<Types.JobId, Types.IncentivePool>,
    jobId          : Types.JobId,
    projectPrice   : Nat,
    poolPercent    : Nat,
    elapsedNanos   : Nat,
    estimatedHours : Nat,
  ) : ?Types.IncentivePool {
    let estimatedNanos = estimatedHours * NANOS_PER_HOUR;
    // Only create pool if completed on or before estimated time
    if (elapsedNanos > estimatedNanos) return null;
    let totalPool = projectPrice * poolPercent / 100;
    let pool : Types.IncentivePool = {
      jobId;
      totalPool;
      var primaryWorkerShare = 0;
      var assistWorkerShares = [];
      var earlyBonus = 0;
      var status = #pending;
      var distributedAt = null;
    };
    pools.add(jobId, pool);
    ?pool;
  };

  public func distributeIncentive(
    pools          : Map.Map<Types.JobId, Types.IncentivePool>,
    ledger         : List.List<Types.IncentiveLedgerEntry>,
    jobId          : Types.JobId,
    primaryWorker  : Types.WorkerId,
    assistEntries  : [Types.WorkerTimeEntry],
    elapsedNanos   : Nat,
    estimatedHours : Nat,
    now            : Types.Timestamp,
  ) : () {
    let pool = switch (pools.get(jobId)) {
      case null Runtime.trap("No incentive pool found for job: " # jobId);
      case (?p) p;
    };
    if (pool.status == #distributed) {
      Runtime.trap("Incentive already distributed for job: " # jobId);
    };
    let totalPool = pool.totalPool;
    // Primary gets 60%, assists share 40%
    let primaryBase = totalPool * 60 / 100;
    let assistTotal = totalPool - primaryBase;

    // Early bonus: elapsed < 90% of estimatedHours
    let earlyThresholdNanos = estimatedHours * NANOS_PER_HOUR * 90 / 100;
    let isEarly = elapsedNanos < earlyThresholdNanos;
    let earlyBonus : Nat = if (isEarly) totalPool * 10 / 100 else 0;

    pool.primaryWorkerShare := primaryBase;
    pool.earlyBonus := earlyBonus;

    // Calculate assist shares proportional to tracked time
    let totalAssistNanos = assistEntries.foldLeft(0, func(acc, e) { acc + e.trackedNanos });
    let assistShares : [Types.AssistShare] = if (totalAssistNanos == 0 or assistEntries.size() == 0) {
      [];
    } else {
      assistEntries.map<Types.WorkerTimeEntry, Types.AssistShare>(func(e) {
        let share = assistTotal * e.trackedNanos / totalAssistNanos;
        { workerId = e.workerId; amount = share };
      });
    };
    pool.assistWorkerShares := assistShares;
    pool.status := #distributed;
    pool.distributedAt := ?now;

    // Write ledger entries
    let primaryEntry : Types.IncentiveLedgerEntry = {
      workerId = primaryWorker;
      jobId;
      amount = primaryBase + earlyBonus;
      earlyBonus = isEarly;
      distributedAt = now;
    };
    ledger.add(primaryEntry);

    for (share in assistShares.values()) {
      let entry : Types.IncentiveLedgerEntry = {
        workerId = share.workerId;
        jobId;
        amount = share.amount;
        earlyBonus = false;
        distributedAt = now;
      };
      ledger.add(entry);
    };
  };

  public func getLedgerByWorker(
    ledger   : List.List<Types.IncentiveLedgerEntry>,
    workerId : Types.WorkerId,
  ) : [Types.IncentiveLedgerEntry] {
    ledger.filter(func(e) { e.workerId == workerId }).toArray();
  };

  public func getAllLedgerEntries(
    ledger : List.List<Types.IncentiveLedgerEntry>,
  ) : [Types.IncentiveLedgerEntry] {
    ledger.toArray();
  };

  public func getPendingIncentivePools(
    pools : Map.Map<Types.JobId, Types.IncentivePool>,
  ) : [Types.IncentivePoolView] {
    var result : [Types.IncentivePoolView] = [];
    for ((_jobId, pool) in pools.entries()) {
      if (pool.status == #pending) {
        result := result.concat([poolToView(pool)]);
      };
    };
    result;
  };

  public func getIncentivePoolView(
    pools : Map.Map<Types.JobId, Types.IncentivePool>,
    jobId : Types.JobId,
  ) : ?Types.IncentivePoolView {
    switch (pools.get(jobId)) {
      case null null;
      case (?p) ?poolToView(p);
    };
  };

  func poolToView(p : Types.IncentivePool) : Types.IncentivePoolView {
    {
      jobId = p.jobId;
      totalPool = p.totalPool;
      primaryWorkerShare = p.primaryWorkerShare;
      assistWorkerShares = p.assistWorkerShares;
      earlyBonus = p.earlyBonus;
      status = p.status;
      distributedAt = p.distributedAt;
    };
  };
};
