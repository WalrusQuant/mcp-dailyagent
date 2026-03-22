"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";
import { Model } from "./models";

interface ModelsData {
  chatModels: Model[];
  imageModels: Model[];
  defaultChatModel: string;
  defaultImageModel: string;
  isAdmin: boolean;
}

const defaultModels: ModelsData = {
  chatModels: [],
  imageModels: [],
  defaultChatModel: "",
  defaultImageModel: "",
  isAdmin: false,
};

let cachedModels: ModelsData | null = null;
let fetchPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ModelsData {
  return cachedModels || defaultModels;
}

function notify() {
  listeners.forEach((l) => l());
}

async function doFetch() {
  try {
    const res = await fetch("/api/models");
    if (res.ok) {
      cachedModels = await res.json();
      notify();
    }
  } catch {
    // Keep current values on error
  } finally {
    fetchPromise = null;
  }
}

export function useModels() {
  const models = useSyncExternalStore(subscribe, getSnapshot, () => defaultModels);

  useEffect(() => {
    if (!cachedModels && !fetchPromise) {
      fetchPromise = doFetch();
    }
  }, []);

  const refresh = useCallback(async () => {
    cachedModels = null;
    notify();
    await doFetch();
  }, []);

  return { ...models, refresh };
}
