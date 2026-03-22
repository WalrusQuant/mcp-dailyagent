import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { MessageSquare } from "lucide-react";

export default async function Home() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/dashboard");
    }
  } catch {
    // Supabase not configured yet
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="w-full max-w-sm">
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
              Chat
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
      </div>
    </div>
  );
}
