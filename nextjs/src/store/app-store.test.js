import assert from "node:assert/strict";
import test from "node:test";
import { createAppStore } from "./app-store.js";

test("shared app state exposes React-style updater actions and isolates separate stores", () => {
  const firstUserStore = createAppStore({ demoMode: true });
  const secondUserStore = createAppStore();

  firstUserStore.getState().setCart([{ productId: "offer-1", quantity: 1 }]);
  firstUserStore.getState().setCart(current => current.map(item => ({ ...item, quantity: item.quantity + 1 })));
  firstUserStore.getState().setCartForUser("customer-1", firstUserStore.getState().cart);
  firstUserStore.getState().setAccount({ id: "customer-1", role: "consumer" });

  assert.deepEqual(firstUserStore.getState().cart, [{ productId: "offer-1", quantity: 2 }]);
  assert.equal(firstUserStore.getState().cartOwnerId, "customer-1");
  assert.equal(firstUserStore.getState().cartReadyUserId, "customer-1");
  assert.equal(firstUserStore.getState().account.id, "customer-1");
  assert.deepEqual(secondUserStore.getState().cart, []);
  assert.equal(secondUserStore.getState().account, null);
});

test("environment configuration sets demo/live initial data without overwriting user state", () => {
  const store = createAppStore();
  store.getState().setAccount({ id: "merchant-1", role: "merchant" });
  store.getState().configureForEnvironment({ demoMode: true, supabaseConfigured: false });

  assert.equal(store.getState().authReady, true);
  assert.equal(store.getState().account.id, "merchant-1");
  assert.ok(store.getState().products.length > 0);
  assert.equal(store.getState().catalogLoading, false);

  store.getState().configureForEnvironment({ demoMode: false, supabaseConfigured: true });
  assert.equal(store.getState().authReady, false);
  assert.deepEqual(store.getState().products, []);
  assert.equal(store.getState().catalogLoading, true);
});

test("admin data updates only apply to the staff account that requested them", () => {
  const store = createAppStore();
  store.getState().setAdminDataOwnerId("staff-2");

  store.getState().setAdminDataForOwner("staff-1", {
    merchantApplications: [{ id: "private-application" }],
    complaintCases: [],
    financialApprovals: [],
    auditEvents: [],
  });
  assert.deepEqual(store.getState().adminMerchantApplications, []);

  store.getState().setAdminDataForOwner("staff-2", {
    merchantApplications: [{ id: "authorized-application" }],
    complaintCases: [],
    financialApprovals: [],
    auditEvents: [],
  });
  assert.deepEqual(store.getState().adminMerchantApplications, [{ id: "authorized-application" }]);
});
