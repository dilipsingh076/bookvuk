"use client";

/**
 * Where the books are going.
 *
 * Saved addresses first, and only the order's first-ever address gets typed
 * out: a returning customer taps a radio and is done. "Use a new address" is
 * the last option rather than the first so the common case is the top one.
 */

import { Input } from "../../components/ui";
import type { Address, AddressInput } from "../../api/commerce";

type AddressFieldsProps = {
  addresses: Address[];
  selectedAddressId: string;
  /** `""` selects the new-address form. */
  onSelect: (id: string) => void;
  usingSaved: boolean;
  form: AddressInput;
  onFieldChange: (key: keyof AddressInput, value: string) => void;
  saveAddress: boolean;
  onSaveAddressChange: (save: boolean) => void;
};

const AddressFields = ({
  addresses,
  selectedAddressId,
  onSelect,
  usingSaved,
  form,
  onFieldChange,
  saveAddress,
  onSaveAddressChange,
}: AddressFieldsProps) => {
  const field = (
    label: string,
    key: keyof AddressInput,
    opts: { required?: boolean; type?: string } = {},
  ) => (
    <div>
      <label className="text-sm font-semibold text-bookvuk-navy">{label}</label>
      <Input
        value={(form[key] as string) || ""}
        onChange={(e) => onFieldChange(key, e.target.value)}
        type={opts.type || "text"}
        required={opts.required !== false}
        className="mt-2 rounded-lg px-3 py-2"
      />
    </div>
  );

  return (
    <>
      <div className="text-lg font-bold text-bookvuk-navy">Delivery address</div>

      {addresses.length > 0 ? (
        <div className="mt-4 space-y-2">
          {addresses.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-bookvuk-border p-3 text-sm"
            >
              <input
                type="radio"
                name="address"
                checked={selectedAddressId === a.id}
                onChange={() => onSelect(a.id)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-bookvuk-navy">{a.full_name}</span>
                <span className="block text-bookvuk-muted">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal_code}
                </span>
                <span className="block text-bookvuk-muted">{a.phone}</span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-bookvuk-border p-3 text-sm">
            <input
              type="radio"
              name="address"
              checked={selectedAddressId === ""}
              onChange={() => onSelect("")}
            />
            <span className="font-semibold text-bookvuk-navy">Use a new address</span>
          </label>
        </div>
      ) : null}

      {!usingSaved ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("Full name", "full_name")}
          {field("Phone", "phone", { type: "tel" })}
          <div className="sm:col-span-2">{field("Address line 1", "line1")}</div>
          <div className="sm:col-span-2">
            {field("Address line 2 (optional)", "line2", { required: false })}
          </div>
          {field("City", "city")}
          {field("State", "state")}
          {field("Postal code", "postal_code")}
          {field("Country code", "country")}
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-bookvuk-navy">
            <input
              type="checkbox"
              checked={saveAddress}
              onChange={(e) => onSaveAddressChange(e.target.checked)}
            />
            Save this address for next time
          </label>
        </div>
      ) : null}
    </>
  );
};

export default AddressFields;
