import { modelVendorIds, type ModelVendorId } from "@/lib/tu-shared-browser";

export type ModelVendorOption = {
  id: ModelVendorId;
  label: string;
};

/** Curated vendor dropdown; id matches logo stem under /public/logo. */
export const modelVendors: ModelVendorOption[] = [
  { id: "ChatGPT", label: "OpenAI" },
  { id: "Claude", label: "Anthropic" },
  { id: "Gemini", label: "Google" },
  { id: "Grok", label: "xAI" },
  { id: "meta", label: "Meta" },
  { id: "Mistral AI", label: "Mistral AI" },
  { id: "Cohere", label: "Cohere" },
  { id: "DeepSeek", label: "DeepSeek" },
  { id: "Qwen", label: "通义千问" },
  { id: "Kimi", label: "月之暗面 Kimi" },
  { id: "bigmodel", label: "智谱" },
  { id: "MiniMax", label: "MiniMax" },
  { id: "bytedance", label: "字节跳动" },
  { id: "kling", label: "快手可灵" },
  { id: "runway", label: "Runway" },
  { id: "sora", label: "Sora" },
  { id: "Mid Journey", label: "Midjourney" },
  { id: "stability.ai", label: "Stability AI" },
  { id: "Fireworks AI", label: "Fireworks AI" },
  { id: "perplexity", label: "Perplexity" },
  { id: "azure", label: "Azure" },
  { id: "Microsoft Copilot", label: "Microsoft Copilot" },
  { id: "Hugging Face", label: "Hugging Face" },
  { id: "ollama", label: "Ollama" },
  { id: "suno", label: "Suno" },
  { id: "Codex", label: "Codex" },
  { id: "Poe", label: "Poe" },
  { id: "Notion", label: "Notion" },
  { id: "manus", label: "Manus" },
  { id: "Apple Intelligent", label: "Apple Intelligence" },
  { id: "Antigravity", label: "Antigravity" },
  { id: "happyhorse", label: "HappyHorse" },
];

const vendorLabelById = new Map(
  modelVendors.map((item) => [item.id, item.label] as const),
);

export function modelVendorLabel(id: string | null | undefined): string {
  if (!id) {
    return "";
  }
  const normalized = normalizeModelVendorId(id);
  return vendorLabelById.get(normalized as ModelVendorId) ?? id;
}

/** Map legacy vendor ids to the current catalog id. */
export function normalizeModelVendorId(id: string): string {
  const key = id.trim().toLowerCase().replace(/[\s._-]+/g, "");
  if (key === "seeddance" || key === "seedance" || key === "seedream" || key === "doubao") {
    return "bytedance";
  }
  return id;
}

export function isKnownModelVendor(id: string): id is ModelVendorId {
  return (modelVendorIds as readonly string[]).includes(
    normalizeModelVendorId(id),
  );
}
