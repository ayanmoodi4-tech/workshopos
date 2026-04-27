import List "mo:core/List";
import Common "../types/common";
import Types "../types/core";

module {
  public func createProduct(
    products : List.List<Types.Product>,
    nextId : Nat,
    input : Types.CreateProductInput,
  ) : (Types.Product, Nat) {
    let product : Types.Product = {
      id = nextId;
      name = input.name;
      code = input.code;
      notes = input.notes;
      active = true;
    };
    products.add(product);
    (product, nextId + 1);
  };

  public func deactivateProduct(
    products : List.List<Types.Product>,
    productId : Common.ProductId,
  ) : Bool {
    var found = false;
    products.mapInPlace(func(p) {
      if (p.id == productId and p.active) {
        found := true;
        { p with active = false };
      } else p;
    });
    found;
  };

  public func listActiveProducts(products : List.List<Types.Product>) : [Types.Product] {
    products.filter(func(p) { p.active }).toArray();
  };

  public func bulkUpsertProducts(
    products : List.List<Types.Product>,
    nextId : Nat,
    inputs : [Types.BulkUpsertProductInput],
  ) : Nat {
    var count = 0;
    var currentId = nextId;
    for (input in inputs.values()) {
      // Try to find existing by name (case-sensitive)
      let existing = products.find(func(p) { p.name == input.name });
      switch (existing) {
        case (?_p) {
          // Update existing (reactivate if needed)
          products.mapInPlace(func(p) {
            if (p.name == input.name) {
              { p with code = input.code; notes = input.notes; active = true };
            } else p;
          });
        };
        case null {
          let product : Types.Product = {
            id = currentId;
            name = input.name;
            code = input.code;
            notes = input.notes;
            active = true;
          };
          products.add(product);
          currentId += 1;
        };
      };
      count += 1;
    };
    count;
  };

  public func getProduct(
    products : List.List<Types.Product>,
    productId : Common.ProductId,
  ) : ?Types.Product {
    products.find(func(p) { p.id == productId });
  };
};
