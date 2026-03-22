import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/app-config";

export async function POST(request: NextRequest) {
  const { email, password, secretCode } = await request.json();

  // Validate secret code
  const validSecret = await getConfig("signup_secret");

  if (!validSecret) {
    return NextResponse.json(
      { error: "Signup is disabled" },
      { status: 403 }
    );
  }

  if (secretCode !== validSecret) {
    return NextResponse.json(
      { error: "Invalid access code" },
      { status: 403 }
    );
  }

  // Validate inputs
  const trimmedEmail = typeof email === "string" ? email.trim() : "";
  const trimmedPassword = typeof password === "string" ? password : "";

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  if (trimmedPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Create user with Supabase
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password: trimmedPassword,
  });

  if (error) {
    console.error("Signup error:", error.message);
    // Surface safe error messages; avoid leaking user-enumeration details
    const safeMessage = error.message.includes("already registered")
      ? "An account with this email already exists"
      : "Signup failed. Please check your email and password.";
    return NextResponse.json({ error: safeMessage }, { status: 400 });
  }

  return NextResponse.json({ success: true, user: data.user });
}
