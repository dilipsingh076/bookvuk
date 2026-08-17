import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import type { Location } from "react-router-dom";
import Navbar from "../components/layout/Navbar";

import Home from "../pages/Home";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Landing from "../pages/Landing";
import Browse from "../pages/Browse";
import BookDetails from "../pages/BookDetails";
import Cart from "../pages/Cart";
import Wishlist from "../pages/Wishlist";
import Checkout from "../pages/Checkout";
import Profile from "../pages/Profile";
import Settings from "../pages/Settings";
import Help from "../pages/Help";
import About from "../pages/About";
import Contact from "../pages/Contact";
import Orders from "../pages/Orders";
import OrderDetail from "../pages/OrderDetail";
import Modal from "../components/ui/Modal";

import Dashboard from "../pages/Admin/Dashboard";
import ManageBooks from "../pages/Admin/ManageBooks";
import Categories from "../pages/Admin/Categories";
import ManageAuthors from "../pages/Admin/ManageAuthors";
import Inventory from "../pages/Admin/Inventory";
import AdminOrders from "../pages/Admin/Orders";
import AdminSettings from "../pages/Admin/AdminSettings";
import AdminNotifications from "../pages/Admin/Notifications";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { AuthModalProvider } from "../context/AuthModalContext";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "../context/WishlistProvider";
import { NotificationsProvider } from "../context/NotificationsContext";
import RoleRouteGuard from "./RoleRouteGuard";

type BackgroundState = {
  background?: Location;
  search?: string;
};

const AppRoutesInner = () => {
  const location = useLocation();
  const backgroundLocation = (location.state as BackgroundState | undefined)
    ?.background;
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "register">(
    "login",
  );
  const { isAuthenticated } = useAuth();
  const hideNavbar =
    !backgroundLocation && location.pathname === "/register";

  const navigate = useNavigate();

  const openLoginModal = () => {
    setAuthModalView("login");
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthModalView("register");
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setAuthModalOpen(false);
  }, [isAuthenticated]);

  const authModalApi = { openLoginModal, openRegisterModal };

  return (
    <AuthModalProvider value={authModalApi}>
      <div className="min-h-screen bg-booknest-cream">
        {!hideNavbar ? <Navbar /> : null}
        <main className="w-full px-4">
          <Routes location={backgroundLocation || location}>
            <Route path="/" element={<Landing />} />
            <Route
              path="/browse"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <Browse />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/home"
              element={
                <RoleRouteGuard variant="authenticatedOnly">
                  <Home />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/register"
              element={
                <RoleRouteGuard variant="unauthenticatedOnly">
                  <Modal
                    isOpen={true}
                    onClose={() => navigate("/", { replace: true })}
                  >
                    <Register
                      embedded
                      onCancel={() => navigate("/", { replace: true })}
                      onSwitchToLogin={() => {
                        navigate("/", { replace: true });
                        queueMicrotask(() => openLoginModal());
                      }}
                    />
                  </Modal>
                </RoleRouteGuard>
              }
            />
            <Route
              path="/cart"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <Cart />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/wishlist"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <Wishlist />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/checkout"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <Checkout />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/orders"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <Orders />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/orders/:orderId"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <OrderDetail />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/profile"
              element={
                <RoleRouteGuard variant="authenticatedOnly">
                  <Profile />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RoleRouteGuard variant="authenticatedOnly">
                  <Settings />
                </RoleRouteGuard>
              }
            />
            <Route path="/help" element={<Help />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />

            <Route
              path="/admin"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <Dashboard />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/books"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <ManageBooks />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <Categories />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/authors"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <ManageAuthors />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <Inventory />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <AdminOrders />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <AdminNotifications />
                </RoleRouteGuard>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RoleRouteGuard variant="adminOnly">
                  <AdminSettings />
                </RoleRouteGuard>
              }
            />

            <Route
              path="/books/:bookId"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <BookDetails />
                </RoleRouteGuard>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {backgroundLocation ? (
          <Routes>
            <Route
              path="/books/:bookId"
              element={
                <RoleRouteGuard variant="customerRoutes">
                  <BookDetails isModal />
                </RoleRouteGuard>
              }
            />
          </Routes>
        ) : null}

        <Modal isOpen={authModalOpen} onClose={closeAuthModal}>
          {authModalView === "login" ? (
            <Login
              embedded
              onCancel={closeAuthModal}
              onSwitchToRegister={openRegisterModal}
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

const AppRoutes = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <NotificationsProvider>
            <AppRoutesInner />
          </NotificationsProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default AppRoutes;
