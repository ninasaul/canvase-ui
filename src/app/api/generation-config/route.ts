import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import {
  deleteGenerationConfig,
  getGenerationConfigPublicView,
  upsertGenerationConfig,
} from "@/lib/generation/generation-config-server";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const modelSchema = z.object({
  id: z.string().trim().min(1).max(255),
  capability: z.enum(["image", "video", "chat"]),
  displayName: z.string().trim().max(255).optional(),
  vendor: z.string().trim().max(64).optional(),
});

const profileSchema = z.object({
  baseUrl: z.string().trim().max(500),
  apiKey: z.string().max(2048).optional(),
  name: z.string().trim().max(120).optional(),
});

const putSchema = z.object({
  activeVendorId: z.string().trim().min(1).max(64),
  profiles: z.record(z.string(), profileSchema),
  models: z.array(modelSchema).max(500),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const view = await getGenerationConfigPublicView(user.id);
  return jsonOk(view);
}

export async function PUT(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  try {
    const view = await upsertGenerationConfig(user.id, {
      activeVendorId: parsed.data.activeVendorId,
      profiles: parsed.data.profiles,
      models: parsed.data.models,
    });
    return jsonOk(view);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Failed to save generation config",
      500,
    );
  }
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  await deleteGenerationConfig(user.id);
  const view = await getGenerationConfigPublicView(user.id);
  return jsonOk(view);
}
