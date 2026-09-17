"use client";

/**
 * Creating an account.
 *
 * What happens afterwards differs by placement: in the dialog the visitor is
 * already where they wanted to be, so it just swaps to the sign-in pane; on the
 * standalone page there is nowhere to stay, so it goes home and raises the
 * sign-in dialog there.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import { EMPTY_FIELDS, type RegisterFields, type RegisterProps } from "./types";

export const useRegister = ({
  embedded = false,
  onSwitchToLogin,
}: Pick<RegisterProps, "embedded" | "onSwitchToLogin">) => {
  const router = useRouter();
  const { register } = useAuth();
  const { openLoginModal } = useAuthModal();

  const [fields, setFields] = useState<RegisterFields>(EMPTY_FIELDS);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(fields.name, fields.username, fields.email, fields.password);
      if (embedded) {
        onSwitchToLogin?.();
      } else {
        router.replace("/");
        queueMicrotask(() => openLoginModal());
      }
    } catch (e2: unknown) {
      const msg = (e2 as { message?: string } | undefined)?.message;
      setError(msg || "Register failed");
    }
  };

  return {
    fields,
    setField: (key: keyof RegisterFields, value: string) =>
      setFields((prev) => ({ ...prev, [key]: value })),
    showPassword,
    toggleShowPassword: () => setShowPassword((v) => !v),
    error,
    submit,
    openLoginModal,
  };
};

export type UseRegister = ReturnType<typeof useRegister>;
