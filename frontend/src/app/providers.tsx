"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { LoaderBlock } from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "@/views/Login";
import Register from "@/views/Register";
import ResetPassword from "@/views/ResetPassword";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AuthModalProvider } from "@/context/AuthModalContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistProvider";
import { NotificationsProvider } from "@/context/NotificationsContext";

/* The application shell: providers, the navbar, and the sign-in dialog.
 *
 * This is a client component because the session, the cart and the auth dialog
 * are all browser state. Note that `children` can still be a *server* component
 * — Next renders those on the server and passes the finished tree through, which
 * is what lets the catalogue pages below be server-rendered while the shell
 * around them stays interactive.
 *
 * Ported from the old `AppRoutesInner`. The provider nesting order is load
 * bearing: cart and wishlist read the token from `AuthProvider`.
 */
const Shell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register" | "reset">("login");
  // An action a guest attempted, replayed once they sign in.
  const pendingAction = useRef<(() => void) | null>(null);

  // `/register` is its own full-page dialog, so the navbar would be a second
  // header above it.
  const hideNavbar = pathname === "/register";

  const openLoginModal = () => {
    setAuthModalView("login");
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  };

  /* Resetting a password used to navigate to /reset-password, which closed the
     sign-in dialog and moved the visitor off whatever page they were on. It is
     the same conversation as signing in, so it stays in the same dialog. */
  const openResetModal = () => {
    setAuthModalView("reset");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
      return;
    }
    pendingAction.current = action;
    openLoginModal();
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    setAuthModalOpen(false);

    const action = pendingAction.current;
    pendingAction.current = null;
    if (!action) return;
    // Defer so the cart/wishlist providers can pick up the new token and load
    // their state before the replayed action mutates it.
    const timer = window.setTimeout(action, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  const authModalApi = { openLoginModal, openRegisterModal, openResetModal, requireAuth };

  return (
    <AuthModalProvider value={authModalApi}>
      <div className="min-h-screen bg-bookvuk-cream">
        {!hideNavbar ? <Navbar /> : null}
        <main className="w-full px-4">
          {/* Inside <main> so the navbar survives a page-level crash: the visitor
              keeps their cart badge and a way out, instead of a blank document. */}
          <ErrorBoundary>
            <Suspense
              fallback={<LoaderBlock height="page" />}
            >
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>

        <Modal isOpen={authModalOpen} onClose={closeAuthModal}>
          {authModalView === "reset" ? (
            <ResetPassword embedded onDone={openLoginModal} onCancel={closeAuthModal} />
          ) : authModalView === "login" ? (
            <Login
              embedded
              /* Raised over whatever page the visitor was using, so signing in
                 must not move them: the action they were part-way through is
                 replayed in place and shows its own result. */
              redirectOnSuccess={false}
              onCancel={closeAuthModal}
              onSwitchToRegister={openRegisterModal}
              onForgotPassword={openResetModal}
            />
          ) : (
            <Register
              embedded
              onCancel={closeAuthModal}
              onSwitchToLogin={openLoginModal}
            />
          )}
        </Modal>
      </div>
    </AuthModalProvider>
  );
};

const Providers = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <CartProvider>
      <WishlistProvider>
        <NotificationsProvider>
          <Shell>{children}</Shell>
        </NotificationsProvider>
      </WishlistProvider>
    </CartProvider>
  </AuthProvider>
);

export default Providers;
