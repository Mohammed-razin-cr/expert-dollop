"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/api/client";
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (loading) return;
    setLoading(true);
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === "saqib@electrobtech.in") {
      try {
        const response = await fetch('/auth/demo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        })
        if (!response.ok) {
          const result = await response.json().catch(() => null)
          setError(result?.error ?? 'Invalid email or password.')
          setLoading(false)
          return
        }
        router.replace("/marketing-preview");
      } catch {
        setError("Unable to sign in. Please try again when the server is available.");
        setLoading(false);
      }
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setError(
        "Unable to sign in. Please try again when the server is available.",
      );
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <img
            src="/electrobtech-logo.jpg"
            alt="Electrobtech"
            className="h-10 w-10 rounded-xl object-contain"
          />
          <div>
            <p className="font-semibold text-slate-900">Electrobtech OMS</p>
            <p className="text-xs text-slate-400">Sign in to continue</p>
          </div>
        </div>

        {!process.env.NEXT_PUBLIC_ANON_KEY && (
          <div className="mb-5 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            <FlaskConical
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p>
              <span className="font-medium">Digital Marketing testing:</span>{" "}
              use <span className="font-medium">saqib@electrobtech.in</span>.
              This is a database-free demo workspace.
            </p>
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void signIn();
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <span className="relative mt-1.5 block">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full rounded-md border border-slate-200 px-3 py-2.5 pr-11 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500 hover:text-slate-800"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-md bg-blue-700 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
