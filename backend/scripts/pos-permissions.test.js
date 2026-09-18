import { strict as assert } from "node:assert";
import { test } from "node:test";
import masterRoutes from "../src/routes/master.routes.js";

function authorization(method, resource, permissions) {
  const layer = masterRoutes.stack.find(
    (entry) => entry.route?.path === "/:resource" && entry.route.methods[method],
  );
  assert.ok(layer, `Missing ${method} /:resource route`);
  let result;
  layer.route.stack[0].handle(
    { params: { resource }, user: { isSuperAdmin: false, permissions } },
    {},
    (error) => { result = error || "allowed"; },
  );
  return result;
}

test("cashier can load payment methods without settings access", () => {
  assert.equal(authorization("get", "paymentMethods", ["payments.create"]), "allowed");
  assert.equal(authorization("get", "paymentMethods", ["orders.create"]), "allowed");
});

test("payment method changes still require settings.manage", () => {
  const denied = authorization("post", "paymentMethods", ["payments.create"]);
  assert.equal(denied.status, 403);
  assert.equal(authorization("post", "paymentMethods", ["settings.manage"]), "allowed");
});
