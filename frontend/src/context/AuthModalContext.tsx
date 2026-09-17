"use client";

import { createContext, useContext, type ReactNode } from "react";

type AuthModalContextValue = {
  openLoginModal: () => void;
  openRegisterModal: () => void;
  /** The password-reset dialog, raised in place of navigating away. */
  openResetModal: () => void;
  /**
   * Gate an action behind sign-in without losing it.
   *
   * Signed in: runs immediately. Guest: remembers the action, opens the sign-in
   * modal, and replays it once sign-in succeeds — so "add to cart" as a guest
   * ends with the book in the cart instead of the user landing on an empty page
   * wondering what happened to their click.
   */
  requireAuth: (action: () => void) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export const AuthModalProvider = ({
  children,
  value
}: {
  children: ReactNode;
  value: AuthModalContextValue;
}) => <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;

export const useAuthModal = (): AuthModalContextValue => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
};
