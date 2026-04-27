import Common "../types/common";
import T "../types/attendance-notifications";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Principal "mo:core/Principal";

module {
  // ─── Attendance ───────────────────────────────────────────────────────────

  public func importAttendance(
    records : List.List<T.AttendanceRecord>,
    nextId : Nat,
    input : T.ImportAttendanceInput,
    biometricMapping : Map.Map<Text, Common.WorkerId>,
    lateThresholdMinutes : Nat,
    now : Common.Timestamp,
  ) : Nat {
    var imported = 0;
    var currentId = nextId;

    // Group raw records by (biometricEmployeeId, date)
    // For simplicity: process each raw record and derive date
    for (raw in input.records.values()) {
      switch (biometricMapping.get(raw.biometricEmployeeId)) {
        case null (); // Skip unmapped employees
        case (?workerId) {
          let date = timestampToDate(raw.eventTimestamp);
          // Find or create attendance record for this worker+date in this batch
          let existing = records.find(func(r : T.AttendanceRecord) : Bool {
            r.workerId == workerId and r.date == date and r.importBatchId == input.batchId
          });
          switch (existing) {
            case (?_r) {
              // Update existing record with check-in/check-out
              records.mapInPlace(func(r : T.AttendanceRecord) : T.AttendanceRecord {
                if (r.workerId == workerId and r.date == date and r.importBatchId == input.batchId) {
                  switch (raw.event) {
                    case (#checkIn) {
                      let isLate = isLateCheckIn(raw.eventTimestamp, lateThresholdMinutes);
                      { r with checkInAt = ?raw.eventTimestamp; isLate };
                    };
                    case (#checkOut) { { r with checkOutAt = ?raw.eventTimestamp } };
                  };
                } else r;
              });
            };
            case null {
              // Create new record
              let (checkIn, checkOut) = switch (raw.event) {
                case (#checkIn) (?raw.eventTimestamp, null);
                case (#checkOut) (null, ?raw.eventTimestamp);
              };
              let isLate = switch (raw.event) {
                case (#checkIn) isLateCheckIn(raw.eventTimestamp, lateThresholdMinutes);
                case _ false;
              };
              let rec : T.AttendanceRecord = {
                id = currentId;
                workerId;
                biometricEmployeeId = raw.biometricEmployeeId;
                date;
                checkInAt = checkIn;
                checkOutAt = checkOut;
                isLate;
                isAbsent = false;
                importedAt = now;
                importBatchId = input.batchId;
              };
              records.add(rec);
              currentId += 1;
              imported += 1;
            };
          };
        };
      };
    };
    imported;
  };

  /// Extract ISO date (YYYY-MM-DD) from a nanosecond timestamp.
  /// Uses rough calculation from epoch.
  func timestampToDate(nanos : Common.Timestamp) : Text {
    // Convert nanos to seconds
    let secs : Int = nanos / 1_000_000_000;
    // Days since Unix epoch
    let days : Int = secs / 86400;
    // Simple Gregorian calendar calculation
    let (y, m, d) = daysToYMD(days);
    let yStr = intPad(y, 4);
    let mStr = intPad(m, 2);
    let dStr = intPad(d, 2);
    yStr # "-" # mStr # "-" # dStr;
  };

  func daysToYMD(days : Int) : (Int, Int, Int) {
    // Algorithm: civil date from days since epoch (1970-01-01)
    let z = days + 719468;
    let era = (if (z >= 0) z else z - 146096) / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if (mp < 10) mp + 3 else mp - 9;
    let yAdj = if (m <= 2) y + 1 else y;
    (yAdj, m, d);
  };

  func intPad(n : Int, width : Nat) : Text {
    let s = if (n >= 0) n.toText() else "-" # ((-n).toText());
    let len = s.size();
    if (len >= width) s
    else {
      var pad = "";
      var i = len;
      while (i < width) { pad #= "0"; i += 1 };
      pad # s;
    };
  };

  func isLateCheckIn(ts : Common.Timestamp, lateThresholdMinutes : Nat) : Bool {
    // lateThresholdMinutes = minutes since midnight
    let secs : Int = ts / 1_000_000_000;
    let secondsInDay = secs % 86400;
    let minutesInDay = secondsInDay / 60;
    minutesInDay > lateThresholdMinutes.toInt();
  };

  public func queryAttendance(
    records : List.List<T.AttendanceRecord>,
    filter : T.AttendanceFilter,
  ) : [T.AttendanceRecord] {
    records.filter(func(r) {
      let matchesWorker = switch (filter.workerId) {
        case null true;
        case (?id) r.workerId == id;
      };
      let matchesFrom = switch (filter.fromDate) {
        case null true;
        case (?d) r.date >= d;
      };
      let matchesTo = switch (filter.toDate) {
        case null true;
        case (?d) r.date <= d;
      };
      let matchesLate = switch (filter.isLate) {
        case null true;
        case (?v) r.isLate == v;
      };
      let matchesAbsent = switch (filter.isAbsent) {
        case null true;
        case (?v) r.isAbsent == v;
      };
      matchesWorker and matchesFrom and matchesTo and matchesLate and matchesAbsent;
    }).toArray();
  };

  public func monthlySummary(
    records : List.List<T.AttendanceRecord>,
    workerId : Common.WorkerId,
    month : Text,
  ) : T.AttendanceSummary {
    let workerRecs = records.filter(func(r) {
      r.workerId == workerId and r.date.size() >= 7 and textPrefix7(r.date) == month
    });
    let daysPresent = workerRecs.filter(func(r) { not r.isAbsent }).size();
    let daysLate = workerRecs.filter(func(r) { r.isLate }).size();
    let daysAbsent = workerRecs.filter(func(r) { r.isAbsent }).size();
    {
      workerId;
      month;
      daysPresent;
      daysLate;
      daysAbsent;
    };
  };

  func textPrefix7(s : Text) : Text {
    // Extract first 7 characters (YYYY-MM)
    var result = "";
    var i = 0;
    for (c in s.toIter()) {
      if (i < 7) { result #= Text.fromChar(c); i += 1 };
    };
    result;
  };

  public func setBiometricMapping(
    biometricMapping : Map.Map<Text, Common.WorkerId>,
    biometricEmployeeId : Text,
    workerId : Common.WorkerId,
  ) : () {
    biometricMapping.add(biometricEmployeeId, workerId);
  };

  public func listBiometricMappings(
    biometricMapping : Map.Map<Text, Common.WorkerId>,
  ) : [(Text, Common.WorkerId)] {
    biometricMapping.toArray();
  };

  // ─── Notifications ────────────────────────────────────────────────────────

  public func createNotification(
    notifications : List.List<T.NotificationRecord>,
    nextId : Nat,
    input : T.CreateNotificationInput,
    now : Common.Timestamp,
  ) : T.NotificationId {
    let notif : T.NotificationRecord = {
      id = nextId;
      recipientRole = input.recipientRole;
      trigger = input.trigger;
      title = input.title;
      message = input.message;
      entityId = input.entityId;
      readBy = [];
      createdAt = now;
    };
    notifications.add(notif);
    nextId;
  };

  public func getNotificationsForPrincipal(
    notifications : List.List<T.NotificationRecord>,
    _caller : Principal,
    role : T.RecipientRole,
  ) : [T.NotificationRecord] {
    notifications.filter(func(n) {
      n.recipientRole == role or n.recipientRole == #all;
    }).toArray();
  };

  public func markAsRead(
    notifications : List.List<T.NotificationRecord>,
    notificationId : T.NotificationId,
    caller : Principal,
  ) : () {
    notifications.mapInPlace(func(n) {
      if (n.id == notificationId) {
        // Check if already in readBy
        let alreadyRead = n.readBy.find(func(p : Principal) : Bool { p == caller });
        switch (alreadyRead) {
          case (?_) n;
          case null {
            { n with readBy = n.readBy.concat([caller]) };
          };
        };
      } else n;
    });
  };

  public func markAllRead(
    notifications : List.List<T.NotificationRecord>,
    caller : Principal,
    role : T.RecipientRole,
  ) : () {
    notifications.mapInPlace(func(n) {
      if (n.recipientRole == role or n.recipientRole == #all) {
        let alreadyRead = n.readBy.find(func(p : Principal) : Bool { p == caller });
        switch (alreadyRead) {
          case (?_) n;
          case null { { n with readBy = n.readBy.concat([caller]) } };
        };
      } else n;
    });
  };

  public func unreadCount(
    notifications : List.List<T.NotificationRecord>,
    caller : Principal,
    role : T.RecipientRole,
  ) : Nat {
    notifications.filter(func(n) {
      if (not (n.recipientRole == role or n.recipientRole == #all)) return false;
      let hasRead = n.readBy.find(func(p : Principal) : Bool { p == caller });
      switch (hasRead) {
        case null true;
        case _ false;
      };
    }).size();
  };

  // ─── Notification Templates ───────────────────────────────────────────────

  public func upsertTemplate(
    templates : List.List<T.NotificationTemplate>,
    nextId : Nat,
    input : T.UpsertTemplateInput,
    caller : Principal,
    now : Common.Timestamp,
  ) : T.TemplateId {
    // Check if a template for this trigger already exists
    let existing = templates.find(func(t : T.NotificationTemplate) : Bool { t.trigger == input.trigger });
    switch (existing) {
      case (?t) {
        // Update existing
        templates.mapInPlace(func(tmpl : T.NotificationTemplate) : T.NotificationTemplate {
          if (tmpl.trigger == input.trigger) {
            {
              tmpl with
              titleTemplate = input.titleTemplate;
              messageTemplate = input.messageTemplate;
              active = input.active;
              updatedAt = now;
              updatedBy = caller;
            };
          } else tmpl;
        });
        t.id;
      };
      case null {
        // Create new
        let tmpl : T.NotificationTemplate = {
          id = nextId;
          trigger = input.trigger;
          titleTemplate = input.titleTemplate;
          messageTemplate = input.messageTemplate;
          active = input.active;
          updatedAt = now;
          updatedBy = caller;
        };
        templates.add(tmpl);
        nextId;
      };
    };
  };

  public func listTemplates(
    templates : List.List<T.NotificationTemplate>,
  ) : [T.NotificationTemplate] {
    templates.toArray();
  };

  public func getTemplateForTrigger(
    templates : List.List<T.NotificationTemplate>,
    trigger : T.NotificationTrigger,
  ) : ?T.NotificationTemplate {
    templates.find(func(t) { t.trigger == trigger and t.active });
  };

  // ─── Admin Settings ───────────────────────────────────────────────────────

  public func getSettings(settings : T.AppSettings) : T.AppSettings {
    settings;
  };

  public func updateSettings(
    settings : T.AppSettings,
    input : T.UpdateSettingsInput,
  ) : T.AppSettings {
    {
      incentivePoolPercent = switch (input.incentivePoolPercent) {
        case null settings.incentivePoolPercent;
        case (?v) v;
      };
      lateThresholdMinutes = switch (input.lateThresholdMinutes) {
        case null settings.lateThresholdMinutes;
        case (?v) v;
      };
      absentFlagDays = switch (input.absentFlagDays) {
        case null settings.absentFlagDays;
        case (?v) v;
      };
      idleDetectionMinutes = switch (input.idleDetectionMinutes) {
        case null settings.idleDetectionMinutes;
        case (?v) v;
      };
      overdueAlertOffsetHours = switch (input.overdueAlertOffsetHours) {
        case null settings.overdueAlertOffsetHours;
        case (?v) v;
      };
      earlyBonusThresholdPercent = switch (input.earlyBonusThresholdPercent) {
        case null settings.earlyBonusThresholdPercent;
        case (?v) v;
      };
    };
  };

  public func defaultSettings() : T.AppSettings {
    {
      incentivePoolPercent = 5;
      lateThresholdMinutes = 480; // 8:00 AM in minutes from midnight
      absentFlagDays = 1;
      idleDetectionMinutes = 15;
      overdueAlertOffsetHours = 1;
      earlyBonusThresholdPercent = 90;
    };
  };
};
