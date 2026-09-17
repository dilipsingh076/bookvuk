"use client";

/**
 * Editing your own account.
 *
 * Two changes in one form, each optional, so the outcome is reported as a list
 * of what actually happened rather than one "Saved": changing the name and
 * changing the password are separate requests, and either can be the only one
 * made.
 */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { changePassword, updateProfile } from "../../api/commerce";
import {
  EMPTY_PASSWORDS,
  MIN_PASSWORD_LENGTH,
  type PasswordFields,
  type ProfileFields,
} from "./types";

export const useProfile = () => {
  const { user, getToken, adoptSession, updateStoredUser } = useAuth();

  const [fields, setFields] = useState<ProfileFields>({ name: "", email: "" });
  const [passwords, setPasswords] = useState<PasswordFields>(EMPTY_PASSWORDS);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFields({ name: user?.name ?? "", email: user?.email ?? "" });
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    const changingPassword =
      passwords.next.trim().length > 0 || passwords.confirm.trim().length > 0;
    if (changingPassword) {
      if (!passwords.current.trim()) {
        setError("Enter your current password to set a new one.");
        return;
      }
      if (passwords.next !== passwords.confirm) {
        setError("New password and confirmation do not match.");
        return;
      }
      if (passwords.next.length < MIN_PASSWORD_LENGTH) {
        setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
    }

    setSaving(true);
    const done: string[] = [];

    try {
      const trimmedName = fields.name.trim();
      if (trimmedName && trimmedName !== (user?.name ?? "")) {
        const updated = await updateProfile(getToken(), { full_name: trimmedName });
        // Keep the cached user in step so the navbar and receipts show the new name.
        updateStoredUser({ name: updated.full_name || updated.username });
        done.push("Name updated");
      }

      if (changingPassword) {
        const result = await changePassword(getToken(), passwords.current, passwords.next);
        // The change revoked every session, including this one, so adopt the
        // fresh pair it returned rather than signing this device out.
        adoptSession(result);
        setPasswords(EMPTY_PASSWORDS);
        done.push(result.message);
      }

      setMessage(done.length ? done.join(" · ") : "Nothing to change.");
    } catch (err: any) {
      setError(err?.message || "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  return {
    user,
    fields,
    setField: (key: keyof ProfileFields, value: string) =>
      setFields((prev) => ({ ...prev, [key]: value })),
    passwords,
    setPassword: (key: keyof PasswordFields, value: string) =>
      setPasswords((prev) => ({ ...prev, [key]: value })),
    saving,
    message,
    error,
    submit,
    /** The avatar's letter. */
    initial: String(user?.name || "U").slice(0, 1).toUpperCase(),
    /** Where "Back" and "Cancel" go, which differs for staff. */
    backPath: user?.role === "admin" ? "/admin" : "/home",
  };
};

export type UseProfile = ReturnType<typeof useProfile>;
