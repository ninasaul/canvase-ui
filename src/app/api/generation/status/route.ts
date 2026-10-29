import { jsonOk } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Public, non-secret readiness for the open-source generation proxy.
 * Used by the canvas UI when local Base URL is empty.
 */
export async function GET() {
  return jsonOk({
    hasServerBaseUrl: Boolean((process.env.GENERATION_BASE_URL ?? "").trim()),
    hasServerApiKey: Boolean((process.env.GENERATION_API_KEY ?? "").trim()),
  });
}
