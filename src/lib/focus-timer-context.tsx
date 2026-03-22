"use client";

import { createContext, useContext, ReactNode } from "react";
import { useFocusTimer } from "@/hooks/useFocusTimer";

type FocusTimerContextType = ReturnType<typeof useFocusTimer>;

const FocusTimerContext = createContext<FocusTimerContextType | null>(null);

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const timer = useFocusTimer();
  return (
    <FocusTimerContext.Provider value={timer}>
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimerContext(): FocusTimerContextType {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimerContext must be used within FocusTimerProvider");
  return ctx;
}
