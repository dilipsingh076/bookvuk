"use client";

/**
 * Asking for a reset link, and using one.
 *
 * Both halves live here because they are one flow with one set of outcomes —
 * and because which half is active is decided by the URL rather than by
 * anything this hook does.
 */

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, requestPasswordReset } from "../../api/commerce";
import { useAuthModal } from "../../context/AuthModalContext";
import type { ResetPasswordProps, ResetStage } from "./types";

export const useResetPassword = ({ onDone }: Pick<ResetPasswordProps, "onDone">) => {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const router = useRouter();
  const { openLoginModal } = useAuthModal();
  const finish = onDone ?? openLoginModal;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = useMemo(() => confirm.length > 0 && password !== confirm, [password, confirm]);

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setMessage(await requestPasswordReset(email.trim()));
    } catch (err: any) {
      setError(err?.message || "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  const setNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      setMessage(await confirmPasswordReset(token, password));
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  };

  const stage: ResetStage = done ? "done" : token ? "choose" : "request";

  return {
    stage,
    email,
    setEmail,
    password,
    setPassword,
    confirm,
    setConfirm,
    mismatch,
    busy,
    message,
    error,
    sendLink,
    setNewPassword,
    /** Leave the reset URL behind before offering sign-in — the token in it is
     *  spent, and a reload of this page would fail on it. */
    goSignIn: () => {
      router.replace("/");
      queueMicrotask(() => finish());
    },
  };
};

type UseResetPassword = ReturnType<typeof useResetPassword>;
