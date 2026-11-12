export const categories = [
  { name: "All items", icon: "grid" },
  { name: "Produce", label: "Fresh produce", icon: "leaf" },
  { name: "Grains", label: "Grains & rice", icon: "wheat" },
  { name: "Pantry", icon: "package" },
  { name: "Protein", label: "Meat & fish", icon: "fish" },
  { name: "Household", icon: "house" },
];

export const starterProducts = [
  { id: "tomatoes", name: "Ripe tomatoes", category: "Produce", price: 2200, unit: "per paint bucket", seller: "Hauwa's fresh stall", rating: 4.9, note: "Market price", image: "photo-1546094096-0df4bcaaa337" },
  { id: "rice", name: "Local rice", category: "Grains", price: 7200, unit: "5kg bag", seller: "Bala Grains & More", rating: 4.8, note: "Price checked", image: "photo-1586201375761-83865001e31c" },
  { id: "onions", name: "Sweet red onions", category: "Produce", price: 1600, unit: "per kg", seller: "Aisha's produce", rating: 4.9, note: "Market price", image: "photo-1508747703725-719777637510" },
  { id: "pepper", name: "Fresh red pepper", category: "Produce", price: 900, unit: "500g basket", seller: "Hauwa's fresh stall", rating: 4.7, note: "Price checked", image: "photo-1588252303782-cb80119abd6d" },
  { id: "groundnuts", name: "Golden groundnuts", category: "Pantry", price: 1800, unit: "1kg measure", seller: "Musa's provisions", rating: 4.8, note: "Market price", image: "photo-1567892737950-30c4db37cd89" },
  { id: "ugu", name: "Fresh ugu leaves", category: "Produce", price: 700, unit: "per bunch", seller: "Grace's garden", rating: 5, note: "Picked today", image: "photo-1518977676601-b53f82aba655" },
  { id: "catfish", name: "Smoked catfish", category: "Protein", price: 3500, unit: "medium size", seller: "Mama T's fish", rating: 4.8, note: "Hub checked", image: "photo-1510130387422-82bed34b37e9" },
  { id: "oil", name: "Palm oil", category: "Pantry", price: 2800, unit: "1 litre bottle", seller: "Musa's provisions", rating: 4.6, note: "Market price", image: "photo-1474979266404-7eaacbcd87c5" },
];

export const starterInventory = [
  { id: "inv-tomatoes", name: "Tomatoes, basket", price: 8500, stock: 12, checked: "Updated today" },
  { id: "inv-rice", name: "Local rice, 5kg", price: 7200, stock: 8, checked: "Updated today" },
  { id: "inv-onions", name: "Red onions, 1kg", price: 1600, stock: 24, checked: "Updated yesterday" },
  { id: "inv-pepper", name: "Fresh pepper, 500g", price: 900, stock: 18, checked: "Updated today" },
];

export const demoOrder = {
  id: "KA-2048",
  status: 1,
  statusLabel: "Quality check in progress",
  area: "Masaka North",
  updatedAt: "Just now",
  items: [{ name: "Local rice", quantity: 1, price: 7200 }],
};

export const starterMerchantOrders = [
  {
    id: "merchant-order-3071",
    reference: "KA-3071",
    status: "awaiting_merchant",
    subtotal: 12600,
    deliveryFee: 500,
    createdAt: "2026-11-12T08:42:00.000Z",
    area: "Masaka North",
    landmark: "Near the community clinic",
    items: [
      { name: "Local rice, 5kg", quantity: 1, price: 7200 },
      { name: "Red onions, 1kg", quantity: 2, price: 2700 },
    ],
  },
  {
    id: "merchant-order-3064",
    reference: "KA-3064",
    status: "preparing",
    subtotal: 8500,
    deliveryFee: 500,
    createdAt: "2026-11-12T07:55:00.000Z",
    acceptedAt: "2026-11-12T08:02:00.000Z",
    area: "Masaka Central",
    landmark: "Main road",
    items: [{ name: "Tomatoes, basket", quantity: 1, price: 8500 }],
    handoffNote: "Packed in a sturdy basket",
  },
  {
    id: "merchant-order-3049",
    reference: "KA-3049",
    status: "at_hub",
    subtotal: 3500,
    deliveryFee: 500,
    createdAt: "2026-11-11T13:20:00.000Z",
    acceptedAt: "2026-11-11T13:25:00.000Z",
    area: "Masaka South",
    landmark: "By the water point",
    items: [{ name: "Smoked catfish", quantity: 1, price: 3500 }],
    shipmentStatus: "at_hub",
    handoffNote: "Order handed to the market hub",
  },
];

export const starterMerchantPayouts = [
  {
    id: "demo-payout-1",
    amount: 23800,
    status: "paid",
    reference: "DEMO-PAYOUT-014",
    periodStart: "2026-11-01",
    periodEnd: "2026-11-07",
    createdAt: "2026-11-08T10:00:00.000Z",
    paidAt: "2026-11-08T10:12:00.000Z",
  },
  {
    id: "demo-payout-2",
    amount: 14600,
    status: "processing",
    reference: "DEMO-PAYOUT-021",
    periodStart: "2026-11-08",
    periodEnd: "2026-11-11",
    createdAt: "2026-11-12T05:30:00.000Z",
  },
];

export function formatNaira(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function readStored(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}
