import List "mo:core/List";
import Principal "mo:core/Principal";
import Common "../types/common";
import Types "../types/core";

module {
  public func logAction(
    auditLog : List.List<Types.AuditEntry>,
    nextId : Nat,
    entityType : Types.AuditEntityType,
    entityId : Text,
    action : Text,
    actorPrincipal : Principal,
    now : Common.Timestamp,
    details : Text,
  ) : (Types.AuditEntry, Nat) {
    let entry : Types.AuditEntry = {
      id = nextId;
      entityType;
      entityId;
      action;
      actorPrincipal;
      timestamp = now;
      details;
    };
    auditLog.add(entry);
    (entry, nextId + 1);
  };

  public func queryAuditLog(
    auditLog : List.List<Types.AuditEntry>,
    filter : Types.AuditQueryFilter,
  ) : [Types.AuditEntry] {
    auditLog.filter(func(e) {
      let matchesType = switch (filter.entityType) {
        case null true;
        case (?t) e.entityType == t;
      };
      let matchesId = switch (filter.entityId) {
        case null true;
        case (?id) e.entityId == id;
      };
      let matchesActor = switch (filter.actorPrincipal) {
        case null true;
        case (?a) Principal.equal(e.actorPrincipal, a);
      };
      let matchesFrom = switch (filter.fromTime) {
        case null true;
        case (?t) e.timestamp >= t;
      };
      let matchesTo = switch (filter.toTime) {
        case null true;
        case (?t) e.timestamp <= t;
      };
      matchesType and matchesId and matchesActor and matchesFrom and matchesTo;
    }).toArray();
  };
};
