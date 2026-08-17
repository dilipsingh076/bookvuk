/** Mock orders for UI demo — not persisted. */

export type OrderTimelineStep = "placed" | "shipped" | "delivered";

export type MockOrderLine = {
  title: string;
  qty: number;
  unitPrice: number;
};

export type MockOrder = {
  id: string;
  orderNumber: string;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: MockOrderLine[];
  currency: "INR";
};

export const mockOrders: MockOrder[] = [
  {
    id: "ord-1001",
    orderNumber: "BK-1001",
    placedAt: "2026-03-28T10:30:00+05:30",
    shippedAt: "2026-03-29T14:00:00+05:30",
    deliveredAt: "2026-04-01T11:20:00+05:30",
    currency: "INR",
    items: [
      { title: "Five Point Someone", qty: 1, unitPrice: 639 },
      { title: "The Alchemist", qty: 1, unitPrice: 399 }
    ]
  },
  {
    id: "ord-1002",
    orderNumber: "BK-1002",
    placedAt: "2026-04-02T09:15:00+05:30",
    shippedAt: "2026-04-03T16:45:00+05:30",
    deliveredAt: null,
    currency: "INR",
    items: [{ title: "Atomic Habits", qty: 2, unitPrice: 549 }]
  },
  {
    id: "ord-1003",
    orderNumber: "BK-1003",
    placedAt: "2026-04-04T08:00:00+05:30",
    shippedAt: null,
    deliveredAt: null,
    currency: "INR",
    items: [{ title: "Ikigai", qty: 1, unitPrice: 450 }]
  }
];

export const getOrderById = (id: string) => mockOrders.find((o) => o.id === id);

export const orderLineTotal = (line: MockOrderLine) => line.qty * line.unitPrice;

export const orderGrandTotal = (order: MockOrder) =>
  order.items.reduce((sum, l) => sum + orderLineTotal(l), 0);
