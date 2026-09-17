"use client";

/** The wallet: a balance and the ledger behind it. */

import { useCallback, useEffect, useState } from "react";
import { fetchWallet, type Wallet } from "../../api/buyback";
import { useAuth } from "../../context/AuthContext";
import { DEFAULT_REDEMPTION_PERCENT } from "./types";

export const useCredit = () => {
  const { getToken } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWallet(await fetchWallet(getToken()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your credit");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    balance: wallet?.balance ?? 0,
    entries: wallet?.entries ?? [],
    maxRedemptionPercent: wallet?.maxRedemptionPercent ?? DEFAULT_REDEMPTION_PERCENT,
  };
};

type UseCredit = ReturnType<typeof useCredit>;
