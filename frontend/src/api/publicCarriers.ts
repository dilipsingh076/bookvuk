/**
 * The courier list.
 *
 * Two flows name a courier from the same registry — an admin dispatching an
 * order, and a seller saying they have posted a book back — so it is served
 * rather than written here. The server refuses any slug not on its own list, and
 * a copy in TypeScript would drift into a dropdown offering couriers every save
 * then rejects.
 */

import { getBaseUrl } from "./index";

export type Carrier = { slug: string; label: string };

export const listCarriers = async (): Promise<Carrier[]> => {
  const res = await fetch(`${getBaseUrl()}/api/shipping/carriers`);
  if (!res.ok) throw new Error("Could not load the courier list");
  return (await res.json()) as Carrier[];
};
