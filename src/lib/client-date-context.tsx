"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { zonedDate, zonedHour } from "@/lib/zoned-dates";

interface ClientDateContextValue { timezone: string; today: string; hour: number }
const fallbackNow = new Date();
const ClientDateContext = createContext<ClientDateContextValue>({ timezone: "UTC", today: zonedDate(fallbackNow, "UTC"), hour: zonedHour(fallbackNow, "UTC") });
export const TIMEZONE_CHANGED_EVENT = "cadence:timezone-changed";

export function ClientDateProvider({ timezone: initialTimezone, children }: { timezone: string; children: React.ReactNode }) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = (event: Event) => setTimezone((event as CustomEvent<string>).detail);
    window.addEventListener(TIMEZONE_CHANGED_EVENT, update);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { window.removeEventListener(TIMEZONE_CHANGED_EVENT, update); window.clearInterval(timer); };
  }, []);
  const value = useMemo(() => ({ timezone, today: zonedDate(now, timezone), hour: zonedHour(now, timezone) }), [timezone, now]);
  return <ClientDateContext.Provider value={value}>{children}</ClientDateContext.Provider>;
}

export function useClientDateContext(): ClientDateContextValue { return useContext(ClientDateContext); }
