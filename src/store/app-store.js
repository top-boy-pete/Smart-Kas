import { create } from "zustand";
import {
  demoOrder, readStored, starterInventory, starterMerchantInsights,
  starterMerchantOrders, starterMerchantPayouts, starterMerchantQuestions, starterProducts,
} from "../data.js";

function storedCart() {
  const saved = readStored("kasua-cart", []);
  return Array.isArray(saved)
    ? saved.filter(line => typeof line.productId === "string" && Number.isInteger(line.quantity) && line.quantity > 0)
    : [];
}

function storedRecord(key) {
  const saved = readStored(key, {});
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

function initialEntryPage(demoMode) {
  const path = typeof window === "undefined" ? "/" : window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/admin" ? demoMode ? "admin" : "staff-login" : "landing";
}

function resolveUpdate(update, current) {
  return typeof update === "function" ? update(current) : update;
}

export function createAppStore({ demoMode = false, supabaseConfigured = false } = {}) {
  const initialState = {
    demoAccount: null,
    demoAccounts: {},
    account: null,
    authReady: !supabaseConfigured,
    entryPage: initialEntryPage(demoMode),
    products: demoMode ? starterProducts : [],
    inventory: demoMode ? starterInventory : [],
    inventoryOwnerId: null,
    inventoryLoading: !demoMode,
    inventoryError: "",
    merchantOrders: demoMode ? starterMerchantOrders : [],
    merchantPayouts: demoMode ? starterMerchantPayouts : [],
    merchantInsights: demoMode ? starterMerchantInsights : [],
    merchantQuestions: demoMode ? starterMerchantQuestions : [],
    customerMerchantQuestions: [],
    customerQuestionsOwner: null,
    customerQuestionsLoading: false,
    customerQuestionsError: "",
    merchantOrdersOwner: null,
    merchantPayoutsOwner: null,
    merchantInsightsOwner: null,
    merchantQuestionsOwner: null,
    merchantOrdersLoading: !demoMode,
    merchantPayoutsLoading: !demoMode,
    merchantInsightsLoading: !demoMode,
    merchantQuestionsLoading: !demoMode,
    merchantOrdersError: "",
    merchantPayoutsError: "",
    merchantInsightsError: "",
    merchantQuestionsError: "",
    questionProduct: null,
    cart: storedCart(),
    cartOwnerId: null,
    cartReadyUserId: null,
    walletBalance: 12450,
    order: demoOrder,
    purchaseHistoryByAccount: storedRecord("kasua-purchase-history"),
    customerPrioritiesByAccount: storedRecord("kasua-customer-priorities"),
    search: "",
    activeCategory: "All items",
    sort: "featured",
    dialog: null,
    editingProduct: null,
    checkoutTotals: null,
    toast: "",
    supportCases: [],
    supportCasesOwnerId: null,
    catalogLoading: !demoMode,
    catalogError: "",
    adminDataOwnerId: null,
    adminMerchantApplications: [],
    adminComplaintCases: [],
    adminFinancialApprovals: [],
    adminAuditEvents: [],
  };

  return create(set => {
    const setters = Object.fromEntries(Object.keys(initialState).map(key => [
      `set${key[0].toUpperCase()}${key.slice(1)}`,
      update => set(state => ({ [key]: resolveUpdate(update, state[key]) })),
    ]));
    return {
      ...initialState,
      ...setters,
      setCartForUser: (ownerId, cart) => set({
        cartOwnerId: ownerId,
        cartReadyUserId: ownerId,
        cart,
      }),
      setAdminDataForOwner: (ownerId, data) => set(state => state.adminDataOwnerId === ownerId ? {
        adminMerchantApplications: data.merchantApplications,
        adminComplaintCases: data.complaintCases,
        adminFinancialApprovals: data.financialApprovals,
        adminAuditEvents: data.auditEvents,
      } : state),
      configureForEnvironment: environment => set({
        authReady: !environment.supabaseConfigured,
        entryPage: initialEntryPage(environment.demoMode),
        products: environment.demoMode ? starterProducts : [],
        inventory: environment.demoMode ? starterInventory : [],
        inventoryLoading: !environment.demoMode,
        merchantOrders: environment.demoMode ? starterMerchantOrders : [],
        merchantPayouts: environment.demoMode ? starterMerchantPayouts : [],
        merchantInsights: environment.demoMode ? starterMerchantInsights : [],
        merchantQuestions: environment.demoMode ? starterMerchantQuestions : [],
        merchantOrdersLoading: !environment.demoMode,
        merchantPayoutsLoading: !environment.demoMode,
        merchantInsightsLoading: !environment.demoMode,
        merchantQuestionsLoading: !environment.demoMode,
        catalogLoading: !environment.demoMode,
      }),
    };
  });
}

export const useAppStore = createAppStore();

export function useAppState(key) {
  const value = useAppStore(state => state[key]);
  const setter = useAppStore(state => state[`set${key[0].toUpperCase()}${key.slice(1)}`]);
  return [value, setter];
}
