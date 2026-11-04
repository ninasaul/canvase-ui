import { z } from "zod";

import { jsonError, jsonOk } from "@/lib/api";
import { listSkills, readSkill } from "@/lib/agent/skills";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

const querySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  file: z.string().trim().min(1).max(240).optional(),
});

/**
 * Skill catalog + one skill's text for the composer's "/" picker.
 * Skills are filesystem-backed and canvas-independent, so any signed-in user
 * can browse them.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    ...(url.searchParams.get("name") ? { name: url.searchParams.get("name") } : {}),
    ...(url.searchParams.get("file") ? { file: url.searchParams.get("file") } : {}),
  });
  if (!parsed.success) {
    return jsonError("Invalid request", 400);
  }

  if (!parsed.data.name) {
    const skills = await listSkills();
    return jsonOk({
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        tags: skill.tags,
      })),
    });
  }

  try {
    const detail = await readSkill({
      name: parsed.data.name,
      ...(parsed.data.file ? { file: parsed.data.file } : {}),
    });
    return jsonOk(detail);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Skill not found",
      404,
    );
  }
}
