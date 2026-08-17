import { createContext, useContext, type ReactNode } from "react";

type AuthModalContextValue = {
  openLoginModal: () => void;
  openRegisterModal: () => void;
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
