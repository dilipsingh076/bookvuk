"use client";

/** Signing in, and where to go afterwards. */

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import type { LoginFields, LoginProps } from "./types";

export const useLogin = ({
  redirectOnSuccess = true,
  onCancel,
  onForgotPassword,
}: Pick<LoginProps, "redirectOnSuccess" | "onCancel" | "onForgotPassword">) => {
  const router = useRouter();
  const { login, loading } = useAuth();

  const [fields, setFields] = useState<LoginFields>({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  // Default on: the behaviour every visitor already had, now actually a choice.
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const nextUser = await login(fields.email, fields.password, remember);
      if (redirectOnSuccess) {
        router.replace(nextUser.role === "admin" ? "/admin" : "/home");
      }
    } catch (e2: unknown) {
      const msg = (e2 as { message?: string } | undefined)?.message;
      setError(msg || "Login failed");
    }
  };

  return {
    fields,
    setField: (key: keyof LoginFields, value: string) =>
      setFields((prev) => ({ ...prev, [key]: value })),
    showPassword,
    toggleShowPassword: () => setShowPassword((v) => !v),
    remember,
    setRemember,
    error,
    loading,
    submit,
    /** In the dialog this raises the reset form in place; on the page it
     *  navigates, closing whatever asked for the sign-in first. */
    forgotPassword: () => {
      if (onForgotPassword) {
        onForgotPassword();
        return;
      }
      onCancel?.();
      router.push("/reset-password");
    },
  };
};

type UseLogin = ReturnType<typeof useLogin>;
