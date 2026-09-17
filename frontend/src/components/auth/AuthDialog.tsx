"use client";

import { useRouter } from "next/navigation";

import Modal from "@/components/ui/Modal";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import Login from "@/views/Login";
import Register from "@/views/Register";

/* `/login` and `/register` as real URLs, presented over the shopfront.
 *
 * These were two files that differed only in which form they rendered and where
 * "switch" pointed — identical apart from the names. One component, one `view`
 * prop.
 *
 * Closing returns to "/" rather than going back, so landing here directly from a
 * shared link does not leave the visitor on a blank history entry.
 */
const AuthDialog = ({ view }: { view: "login" | "register" }) => {
  const router = useRouter();
  const close = () => router.replace("/");

  return (
    <RoleRouteGuard variant="unauthenticatedOnly">
      <Modal isOpen onClose={close}>
        {view === "login" ? (
          <Login
            embedded
            onCancel={close}
            onSwitchToRegister={() => router.replace("/register")}
          />
        ) : (
          <Register
            embedded
            onCancel={close}
            onSwitchToLogin={() => router.replace("/login")}
          />
        )}
      </Modal>
    </RoleRouteGuard>
  );
};

export default AuthDialog;
