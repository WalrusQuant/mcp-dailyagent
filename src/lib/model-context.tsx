"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useModels } from "./useModels";
import { Model } from "./models";

interface ModelContextValue {
  chatModels: Model[];
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  defaultChatModel: string;
}

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { chatModels, defaultChatModel } = useModels();
  const [selectedModel, setSelectedModel] = useState(defaultChatModel || "");

  // Update selected model when default loads and none is selected yet
  if (!selectedModel && defaultChatModel) {
    setSelectedModel(defaultChatModel);
  }

  return (
    <ModelContext.Provider
      value={{ chatModels, selectedModel, setSelectedModel, defaultChatModel }}
    >
      {children}
    </ModelContext.Provider>
  );
}

export function useModelContext() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModelContext must be used within ModelProvider");
  return ctx;
}
