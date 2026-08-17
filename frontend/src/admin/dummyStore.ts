export type AdminBook = {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  status: "active" | "draft";
};

export type AdminAuthor = {
  id: string;
  name: string;
  bio: string;
  status: "active" | "draft";
};

export type AdminOrderItem = {
  bookId: string;
  title: string;
  qty: number;
  price: number;
};

export type AdminOrder = {
  id: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  status: "pending" | "paid" | "packed" | "shipped" | "delivered" | "cancelled";
  items: AdminOrderItem[];
};

type AdminDummyState = {
  authors: AdminAuthor[];
  books: AdminBook[];
  orders: AdminOrder[];
};

const storageKey = "booknest_admin_dummy_v1";

const uid = (prefix: string) =>
  `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;

const seedState = (): AdminDummyState => {
  const authors: AdminAuthor[] = [
    {
      id: "au_emma_clark",
      name: "Emma Clark",
      bio: "Emma writes modern literary fiction with cozy, character-driven plots.",
      status: "active",
    },
    {
      id: "au_daniel_reed",
      name: "Daniel Reed",
      bio: "Daniel writes practical engineering books and guides.",
      status: "active",
    },
    {
      id: "au_sophia_bennett",
      name: "Sophia Bennett",
      bio: "Sophia writes personal growth books and reflective essays.",
      status: "draft",
    },
  ];

  const books: AdminBook[] = [
    {
      id: "bk_silent_library",
      title: "The Silent Library",
      authorId: "au_emma_clark",
      authorName: "Emma Clark",
      category: "Fiction",
      price: 24.99,
      stock: 16,
      rating: 4.3,
      status: "active",
    },
    {
      id: "bk_graphql_faster",
      title: "Build Faster with GraphQL",
      authorId: "au_daniel_reed",
      authorName: "Daniel Reed",
      category: "Technology",
      price: 32.0,
      stock: 5,
      rating: 4.6,
      status: "active",
    },
    {
      id: "bk_small_steps",
      title: "Small Steps Every Day",
      authorId: "au_sophia_bennett",
      authorName: "Sophia Bennett",
      category: "Self Growth",
      price: 18.5,
      stock: 48,
      rating: 4.1,
      status: "draft",
    },
  ];

  const orders: AdminOrder[] = [
    {
      id: "ord_10031",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      customerName: "Aarav Mehta",
      customerEmail: "aarav@example.com",
      status: "paid",
      items: [
        { bookId: "bk_silent_library", title: "The Silent Library", qty: 1, price: 24.99 },
      ],
    },
    {
      id: "ord_10032",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
      customerName: "Isha Sharma",
      customerEmail: "isha@example.com",
      status: "packed",
      items: [
        { bookId: "bk_graphql_faster", title: "Build Faster with GraphQL", qty: 1, price: 32.0 },
        { bookId: "bk_small_steps", title: "Small Steps Every Day", qty: 1, price: 18.5 },
      ],
    },
    {
      id: "ord_10033",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      customerName: "Neha Singh",
      customerEmail: "neha@example.com",
      status: "pending",
      items: [{ bookId: "bk_small_steps", title: "Small Steps Every Day", qty: 2, price: 18.5 }],
    },
  ];

  return { authors, books, orders };
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const readAdminDummyState = (): AdminDummyState => {
  const parsed = safeParse<AdminDummyState>(localStorage.getItem(storageKey));
  if (parsed?.authors && parsed?.books && parsed?.orders) return parsed;
  const seeded = seedState();
  localStorage.setItem(storageKey, JSON.stringify(seeded));
  return seeded;
};

export const writeAdminDummyState = (next: AdminDummyState) => {
  localStorage.setItem(storageKey, JSON.stringify(next));
};

export const computeOrderTotal = (o: AdminOrder): number =>
  o.items.reduce((sum, it) => sum + it.price * it.qty, 0);

export const createAuthor = (partial: Pick<AdminAuthor, "name" | "bio" | "status">): AdminAuthor => ({
  id: uid("au"),
  ...partial,
});

export const createBook = (partial: Omit<AdminBook, "id">): AdminBook => ({
  id: uid("bk"),
  ...partial,
});

export const createOrderId = (): string => `ord_${Math.floor(10000 + Math.random() * 90000)}`;

