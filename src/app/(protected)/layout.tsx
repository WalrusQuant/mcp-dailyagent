import { ProtectedLayoutClient } from "@/components/layout/ProtectedLayoutClient";
import { ClientDateProvider } from "@/lib/client-date-context";
import { getUserId } from "@/lib/auth";
import { resolveDateContext } from "@/lib/date-context";

// The profile timezone is request data. Prevent build-time prerendering from
// opening the production database while still seeding clients on each request.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { timezone } = await resolveDateContext(getUserId());
  return <ClientDateProvider timezone={timezone}><ProtectedLayoutClient>{children}</ProtectedLayoutClient></ClientDateProvider>;
}
