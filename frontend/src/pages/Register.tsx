import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import type { FormEvent } from "react";

type RegisterProps = {
  embedded?: boolean;
  onCancel?: () => void;
  onSwitchToLogin?: () => void;
};

const Register = ({ embedded = false, onCancel, onSwitchToLogin }: RegisterProps) => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { openLoginModal } = useAuthModal();

  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(name, username, email, password);
      if (embedded) {
        onSwitchToLogin?.();
      } else {
        navigate("/", { replace: true });
        queueMicrotask(() => openLoginModal());
      }
    } catch (e2: unknown) {
      const msg = (e2 as { message?: string } | undefined)?.message;
      setError(msg || "Register failed");
    }
  };

  if (embedded) {
    return (
      <div className="w-full bg-white p-6">
        <section className="w-full rounded-2xl border border-booknest-border bg-white p-6">
          <div>
            <h3 className="text-2xl font-bold text-booknest-navy">Create account</h3>
            <p className="mt-1 text-sm text-booknest-muted">
              Fill in your details to continue. After signup, you can log in.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="text-sm font-semibold text-booknest-navy">Full name</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-booknest-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 21a8 8 0 0 0-16 0"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                  />
                </svg>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Username</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-booknest-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 3.13a4 4 0 0 1 0 7.75"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 21v-2a4 4 0 0 0-3-3.87"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                  />
                </svg>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Email address</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-booknest-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l8 6 8-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" opacity="0.2" />
                </svg>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Password</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-booknest-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path d="M5 11V9a7 7 0 1 1 14 0v2" />
                  <path d="M19 11H5v10h14V11Z" />
                </svg>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-xs font-semibold text-booknest-navy hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-2 text-xs font-semibold text-booknest-muted">
                Use at least 6 characters (mock validation).
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl bg-rose-50 p-2 text-lg flex justify-center font-semibold text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-booknest-purple py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
              disabled={false}
            >
              Create account
            </button>

            <button
              type="button"
              onClick={() => onCancel?.()}
              className="w-full rounded-2xl border border-booknest-border bg-white py-3 text-sm font-semibold text-booknest-navy hover:bg-booknest-cream"
            >
              Cancel
            </button>

            <div className="flex justify-center pt-1 text-sm">
              <span className="text-booknest-muted">Already have an account?</span>
              <button
                type="button"
                onClick={() => onSwitchToLogin?.()}
                className="ml-2 font-semibold text-booknest-navy hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-4 flex items-center justify-center">
      <div className="relative grid w-full gap-8 lg:w-[1050px] lg:grid-cols-2 lg:items-stretch">
        <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute -right-10 top-20 h-56 w-56 rounded-full bg-indigo-200/50 blur-3xl" />

        <section className="relative rounded-3xl border border-booknest-border bg-white/70 p-8 shadow-sm backdrop-blur">
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-booknest-lilac text-booknest-navy">
              B
            </span>
            <div>
              <div className="text-sm font-semibold text-booknest-navy">BookNest</div>
              <div className="text-xs font-semibold text-booknest-muted">Create your account</div>
            </div>
          </div>

          <h2 className="mt-5 text-4xl font-extrabold leading-tight text-booknest-navy">
            Join the reading community
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-booknest-muted">
            Save your wishlist, build your cart, and checkout in seconds.
          </p>

          <div className="mt-7 rounded-2xl bg-white/80 p-4 ring-1 ring-booknest-navy/[0.06]">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-booknest-purple text-white shadow-sm">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                  <path
                    d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <div className="text-sm font-semibold text-booknest-navy">Scaffold tip</div>
                <div className="mt-1 text-xs font-semibold text-booknest-muted">
                  Use an email containing <span className="font-bold">admin</span> to get admin role
                  in this mock.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            {[
              { title: "Personalized wishlist", sub: "Keep track of your favorites" },
              { title: "Fast cart updates", sub: "Quantity and totals stay in sync" }
            ].map((x) => (
              <div
                key={x.title}
                className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-booknest-navy/[0.06]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-booknest-lilac text-booknest-navy">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.8 6H20l-5 3.8L16.8 20 12 16.9 7.2 20 9 11.8 4 8h6.2L12 2Z" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-semibold text-booknest-navy">{x.title}</div>
                  <div className="mt-1 text-xs font-semibold text-booknest-muted">{x.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative rounded-3xl border border-booknest-border bg-white p-8 shadow-sm">
          <div>
            <h3 className="text-2xl font-bold text-booknest-navy">Create account</h3>
            <p className="mt-1 text-sm text-booknest-muted">
              Fill in your details. You'll be redirected to login after signup.
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="text-sm font-semibold text-booknest-navy">Full name</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-booknest-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 0 0-16 0" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </svg>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Username</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-booknest-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-3-3.87" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </svg>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Email address</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-booknest-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4z" opacity="0.2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l8 6 8-6" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 18l5-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 18l-5-5" />
                </svg>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-booknest-navy">Password</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-booknest-border bg-booknest-cream px-4 py-3 focus-within:ring-2 focus-within:ring-booknest-purple/40">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-booknest-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 11V9a7 7 0 1 1 14 0v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5v10h14V11Z" />
                </svg>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-xs font-semibold text-booknest-navy hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mt-2 text-xs font-semibold text-booknest-muted">
                Use at least 6 characters (mock validation).
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl bg-rose-50 p-2 text-lg flex justify-center font-semibold text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-booknest-purple py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover"
            >
              Create account
            </button>

            <div className="flex justify-center pt-2 text-sm">
              <span className="text-booknest-muted">Already have an account?</span>
              <button
                type="button"
                onClick={() => openLoginModal()}
                className="ml-2 font-semibold text-booknest-navy hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Register;

