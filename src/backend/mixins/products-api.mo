import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import AccessControl "mo:caffeineai-authorization/access-control";
import Common "../types/common";
import Types "../types/core";
import ProductsLib "../lib/products";
import AuditLib "../lib/audit";

mixin (
  accessControlState : AccessControl.AccessControlState,
  products : List.List<Types.Product>,
  auditLog : List.List<Types.AuditEntry>,
) {
  /// Create a new product. SalesManager or Admin only.
  public shared ({ caller }) func createProduct(input : Types.CreateProductInput) : async Types.Product {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: SalesManager or Admin only");
    };
    let (product, _) = ProductsLib.createProduct(products, products.size() + 1, input);
    let now = Time.now();
    ignore AuditLib.logAction(
      auditLog, auditLog.size() + 1, #product, product.id.toText(),
      "createProduct", caller, now, "Created product: " # input.name,
    );
    product;
  };

  /// Deactivate a product (no delete). Admin only.
  public shared ({ caller }) func deactivateProduct(productId : Common.ProductId) : async Bool {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Unauthorized: Admin only");
    };
    let result = ProductsLib.deactivateProduct(products, productId);
    if (result) {
      let now = Time.now();
      ignore AuditLib.logAction(
        auditLog, auditLog.size() + 1, #product, productId.toText(),
        "deactivateProduct", caller, now, "Deactivated product",
      );
    };
    result;
  };

  /// List all active products.
  public query func listActiveProducts() : async [Types.Product] {
    ProductsLib.listActiveProducts(products);
  };

  /// Bulk upsert products from CSV import. SalesManager or Admin only.
  public shared ({ caller }) func bulkUpsertProducts(inputs : [Types.BulkUpsertProductInput]) : async Nat {
    if (not AccessControl.hasPermission(accessControlState, caller, #admin) and
        not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: SalesManager or Admin only");
    };
    let count = ProductsLib.bulkUpsertProducts(products, products.size() + 1, inputs);
    let now = Time.now();
    ignore AuditLib.logAction(
      auditLog, auditLog.size() + 1, #product, "bulk",
      "bulkUpsertProducts", caller, now, "Bulk upserted " # count.toText() # " products",
    );
    count;
  };
};
