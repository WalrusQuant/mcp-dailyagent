import { getConfig } from "@/lib/app-config";

export interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export async function getTitleModel(): Promise<string> {
  return (await getConfig("title_model")) || "google/gemini-3-flash-preview";
}

// Empty defaults — models come exclusively from the database
export const CHAT_MODELS: Model[] = [];
export const IMAGE_MODELS: Model[] = [];
export const DEFAULT_CHAT_MODEL = "";
export const DEFAULT_IMAGE_MODEL = "";
