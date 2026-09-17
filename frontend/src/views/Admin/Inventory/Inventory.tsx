"use client";

/** What is running out, what has run out, and who is waiting. */

import Modal from "../../../components/ui/Modal";
import { Button, Input } from "../../../components/ui";
import StockColumn from "./StockColumn";
import WaitingList from "./WaitingList";
import { useInventory } from "./useInventory";
import { LOW_STOCK_THRESHOLD } from "./types";

const Inventory = () => {
  const i = useInventory();

  return (
    <>
      <div className="py-8">
        <WaitingList
          rows={i.waitingRows}
          totalWaiting={i.totalWaiting}
          onRestock={i.openRestock}
        />

        <div className="rounded-2xl border bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-2xl font-extrabold text-bookvuk-navy">Inventory</div>
              <div className="mt-1 text-sm text-bookvuk-muted">
                Monitor low stock and restock titles.
              </div>
            </div>
            <button
              type="button"
              onClick={i.refresh}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StockColumn
              heading={`Low stock (≤ ${LOW_STOCK_THRESHOLD})`}
              books={i.lowStock}
              loading={i.loading}
              error={i.error}
              emptyText="No low-stock items."
              actionLabel="Restock"
              onRestock={i.openRestock}
            />
            <StockColumn
              heading="Out of stock"
              books={i.outOfStock}
              loading={i.loading}
              error={i.error}
              emptyText="No out-of-stock items."
              actionLabel="Add stock"
              onRestock={i.openRestock}
              quiet
            />
          </div>
        </div>
      </div>

      <Modal isOpen={i.restockOpen} onClose={i.closeRestock}>
        <div className="border-b border-bookvuk-border px-6 py-4">
          <div className="text-sm font-semibold text-bookvuk-navy">Restock book</div>
        </div>
        <div className="space-y-4 p-6">
          <label className="block">
            <div className="text-xs font-semibold text-bookvuk-muted">Quantity to add</div>
            <Input
              type="number"
              min={0}
              value={i.restockQty}
              onChange={(e) => i.setRestockQty(Number(e.target.value))}
              className="mt-2 rounded-lg px-3 py-2"
            />
          </label>
          {i.restockError ? (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {i.restockError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={i.closeRestock}
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-bookvuk-navy"
            >
              Cancel
            </button>
            <Button
              type="button"
              onClick={i.applyRestock}
              disabled={i.restocking}
              variant="primary-flat"
            >
              {i.restocking ? "Applying…" : "Apply"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Inventory;
