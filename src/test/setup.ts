import "@testing-library/jest-dom/vitest";

// Set required env vars for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.ENCRYPTION_KEY = "a".repeat(64);
