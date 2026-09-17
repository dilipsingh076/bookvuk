"use client";

/** Sign up — in the auth dialog, or as its own two-column page. */

import { Card } from "../../components/ui";
import RegisterAside from "./RegisterAside";
import RegisterForm from "./RegisterForm";
import { useRegister } from "./useRegister";
import type { RegisterProps } from "./types";

const Register = ({ embedded = false, onCancel, onSwitchToLogin }: RegisterProps) => {
  const form = useRegister({ embedded, onSwitchToLogin });

  if (embedded) {
    return (
      <div className="w-full bg-white p-6">
        <Card as="section" radius="2xl" elevation="none" className="w-full border-bookvuk-border">
          <RegisterForm
            form={form}
            /* "After signup, you can log in" was not true: register() persists the
               token and sets the user, so the account is created and signed in by
               the one action. Telling a seller they still have to log in, at the
               moment they are handing over a book, reads as "that did not go
               through" — the one impression this step cannot afford. */
            subtitle="Fill in your details — you will be signed in straight away."
            onSignIn={() => onSwitchToLogin?.()}
            onCancel={() => onCancel?.()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-4 flex items-center justify-center">
      <div className="relative grid w-full gap-8 lg:w-[1050px] lg:grid-cols-2 lg:items-stretch">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute -right-10 top-20 h-56 w-56 rounded-full bg-indigo-200/50 blur-3xl" />

        <RegisterAside />

        <Card as="section" padding="lg" elevation="sm" className="relative border-bookvuk-border">
          <RegisterForm
            form={form}
            subtitle="Fill in your details. You'll be redirected to login after signup."
            onSignIn={form.openLoginModal}
          />
        </Card>
      </div>
    </div>
  );
};

export default Register;
