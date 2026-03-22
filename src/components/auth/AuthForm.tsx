"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const REMEMBERED_EMAIL_KEY = "remembered-email";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberEmail(true);
    }
  }, []);
  const [secretCode, setSecretCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email address first");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/settings`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, secretCode }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Signup failed");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        router.push("/dashboard");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (rememberEmail) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="text-sm rounded-lg p-3"
          style={{
            color: "var(--accent-negative)",
            background: "rgba(248, 113, 113, 0.1)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
          style={{
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
          placeholder="••••••••"
        />
        {mode === "login" && (
          <div className="flex items-center justify-between mt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => {
                  setRememberEmail(e.target.checked);
                  if (!e.target.checked) {
                    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
                  }
                }}
                className="rounded"
                style={{ accentColor: "var(--accent-primary)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Remember email
              </span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--accent-primary)" }}
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>

      {showForgotPassword && mode === "login" && (
        <div
          className="rounded-lg p-3"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
          }}
        >
          {resetSent ? (
            <p className="text-sm" style={{ color: "var(--accent-positive)" }}>
              Password reset email sent. Check your inbox.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Enter your email above and click below to receive a password reset link.
              </p>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isLoading || !email}
                className="w-full rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "var(--accent-primary)",
                  color: "var(--bg-base)",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "signup" && (
        <div>
          <label
            htmlFor="secretCode"
            className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
            style={{ color: "var(--accent-warning)" }}
          >
            Access Code
          </label>
          <input
            id="secretCode"
            type="password"
            value={secretCode}
            onChange={(e) => setSecretCode(e.target.value)}
            required
            className="w-full rounded-lg px-4 py-3 focus:outline-none transition-colors"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-default)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-warning)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-default)")}
            placeholder="Enter access code"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg px-4 py-3 font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        style={{
          background: "var(--accent-primary)",
          color: "var(--bg-base)",
        }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {mode === "signup" ? "Creating account..." : "Signing in..."}
          </>
        ) : mode === "signup" ? (
          "Create account"
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
