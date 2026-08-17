import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loader from "../components/ui/Loader";

type LoginProps = {
  embedded?: boolean;
  onCancel?: () => void;
  onSwitchToRegister?: () => void;
};

const Login = ({ embedded = false, onCancel, onSwitchToRegister }: LoginProps) => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const nextUser = await login(email, password);
      navigate(nextUser.role === "admin" ? "/admin" : "/home", { replace: true });
    } catch (e2: unknown) {
      const msg = (e2 as { message?: string } | undefined)?.message;
      setError(msg || "Login failed");
    }
  };

  return (
    <div
      className={
        embedded
          ? "w-full bg-white p-6"
          : "min-h-screen w-full bg-booknest-cream px-4 flex items-center justify-center"
      }
    >
      <section
        className={
          embedded
            ? "w-full rounded-2xl border border-booknest-border bg-white p-6"
            : "w-full md:w-[448px] rounded-3xl border border-booknest-border bg-white p-8 shadow-sm"
        }
      >
        <div>
          <h3 className="text-2xl font-bold text-booknest-navy">Login</h3>
          <p className="mt-1 text-sm text-booknest-muted">
            Enter your email and password to continue.
          </p>
        </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
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
                  placeholder="Enter your email"
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
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-booknest-muted"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="shrink-0 text-xs font-semibold text-booknest-navy hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-booknest-navy">
                <input type="checkbox" defaultChecked className="h-4 w-4" />
                Remember me
              </label>
              <button
                type="button"
                className="text-sm font-semibold text-booknest-navy hover:underline"
                onClick={() => setError("Password reset is not wired in this UI scaffold.")}
              >
                Forget password?
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl bg-rose-50 p-2 text-lg flex justify-center font-semibold text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-booknest-purple py-3 text-sm font-semibold text-white hover:bg-booknest-purple-hover disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? <Loader /> : null}
              Login to BookNest
            </button>

            {embedded && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="mt-3 w-full rounded-2xl border border-booknest-border bg-white py-3 text-sm font-semibold text-booknest-navy hover:bg-booknest-cream"
              >
                Cancel
              </button>
            ) : null}

            <div className="flex justify-center pt-2 text-sm">
              <span className="text-booknest-muted">Don't have an account?</span>
              {embedded && onSwitchToRegister ? (
                <button
                  type="button"
                  onClick={() => onSwitchToRegister()}
                  className="ml-2 font-semibold text-booknest-navy hover:underline"
                >
                  Sign up
                </button>
              ) : (
                <Link to="/register" className="ml-2 font-semibold text-booknest-navy hover:underline">
                  Sign up
                </Link>
              )}
            </div>
          </form>
      </section>
    </div>
  );
};

export default Login;

