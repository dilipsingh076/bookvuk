"use client";

import { useRouter } from "next/navigation";

import Modal from "@/components/ui/Modal";
import ResetPassword from "@/views/ResetPassword";
import { useAuthModal } from "@/context/AuthModalContext";

/* `/reset-password` still exists as a URL, because the link in the reset e-mail
 * opens a fresh browser with no application state to raise a dialog from. What
 * changed is how it looks: a dialog over the shopfront rather than a page of its
 * own, which is the same treatment `/login` and `/register` get.
 *
 * Reaching it from the sign-in dialog no longer comes here at all — that switches
 * the dialog in place, so the visitor keeps the page they were on.
 */
const ResetPasswordDialog = () => {
  const router = useRouter();
  const { openLoginModal } = useAuthModal();
  const close = () => router.replace("/");

  return (
    <Modal isOpen onClose={close}>
      <ResetPassword
        embedded
        onCancel={close}
        onDone={() => {
          close();
          // Once the password is set, signing in is the next thing they want.
          queueMicrotask(() => openLoginModal());
        }}
      />
    </Modal>
  );
};

export default ResetPasswordDialog;
