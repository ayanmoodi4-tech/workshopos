import List "mo:core/List";
import Common "../types/common";
import Types "../types/core";

module {
  public func createWorker(
    workers : List.List<Types.Worker>,
    nextId : Nat,
    input : Types.CreateWorkerInput,
    now : Common.Timestamp,
  ) : (Types.Worker, Nat) {
    let worker : Types.Worker = {
      id = nextId;
      name = input.name;
      phone = input.phone;
      email = input.email;
      biometricEmployeeId = input.biometricEmployeeId;
      status = #active;
      createdAt = now;
      deactivatedAt = null;
    };
    workers.add(worker);
    (worker, nextId + 1);
  };

  public func updateWorker(
    workers : List.List<Types.Worker>,
    input : Types.UpdateWorkerInput,
  ) : ?Types.Worker {
    var updated : ?Types.Worker = null;
    workers.mapInPlace(func(w) {
      if (w.id == input.id) {
        let newWorker : Types.Worker = {
          w with
          name = input.name;
          phone = input.phone;
          email = input.email;
          biometricEmployeeId = input.biometricEmployeeId;
        };
        updated := ?newWorker;
        newWorker;
      } else w;
    });
    updated;
  };

  public func deactivateWorker(
    workers : List.List<Types.Worker>,
    workerId : Common.WorkerId,
    now : Common.Timestamp,
  ) : Bool {
    var found = false;
    workers.mapInPlace(func(w) {
      if (w.id == workerId and w.status == #active) {
        found := true;
        { w with status = #inactive; deactivatedAt = ?now };
      } else w;
    });
    found;
  };

  public func getWorker(
    workers : List.List<Types.Worker>,
    workerId : Common.WorkerId,
  ) : ?Types.Worker {
    workers.find(func(w) { w.id == workerId });
  };

  public func listWorkersByStatus(
    workers : List.List<Types.Worker>,
    status : ?Types.WorkerStatus,
  ) : [Types.Worker] {
    switch (status) {
      case null workers.toArray();
      case (?s) workers.filter(func(w) { w.status == s }).toArray();
    };
  };
};
