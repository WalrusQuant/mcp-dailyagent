import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { MessageSquare } from "lucide-react";

export default function LoginPage() {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div className="flex items-center justify-center gap-2 mb-6">
        <MessageSquare className="w-6 h-6" style={{ color: "var(--accent-primary)" }} />
        <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
          Sign in
        </h1>
      </div>

      <AuthForm mode="login" />

      <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
        Need an account?{" "}
        <Link href="/signup" className="hover:underline" style={{ color: "var(--accent-primary)" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
