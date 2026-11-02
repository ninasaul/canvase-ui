import { z } from "zod";

import { listSkills, readSkill } from "@/lib/agent/skills";
import { CanvasUpdateError } from "@/lib/canvas/apply-canvas-graph-update";

/** Read-only skill tools available to every agent actor (chat + MCP). */
export const SKILL_TOOL_NAMES = ["skills_list", "skills_read"] as const;

export type SkillToolName = (typeof SKILL_TOOL_NAMES)[number];

export function isSkillToolName(value: string): value is SkillToolName {
  return (SKILL_TOOL_NAMES as readonly string[]).includes(value);
}

const readSkillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Optional file inside the skill folder, e.g. "references/pipeline.md". */
  file: z.string().trim().min(1).max(240).optional(),
});

export const skillToolSchemas: Record<
  SkillToolName,
  { description: string; inputSchema: Record<string, unknown> }
> = {
  skills_list: {
    description:
      "List available skills (id, name, description, tags). Call this before guessing how to do a non-trivial canvas task, then use skills_read for the full instructions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  skills_read: {
    description:
      "Read one skill's full SKILL.md instructions (optionally a resource file inside that skill). Follow the returned instructions; they may reference other files returned in `files`.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill id from skills_list, e.g. \"canvas-graph-workflow\".",
        },
        file: {
          type: "string",
          description:
            "Optional relative file inside the skill folder, e.g. \"references/pipeline.md\".",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

function toSkillError(error: unknown): CanvasUpdateError {
  const message = error instanceof Error ? error.message : "Skill read failed";
  const notFound =
    message.startsWith("Unknown skill") || /not found/i.test(message);
  return new CanvasUpdateError(message, notFound ? 404 : 400);
}

export async function executeSkillTool(input: {
  tool: SkillToolName;
  args: unknown;
}): Promise<unknown> {
  if (input.tool === "skills_list") {
    const skills = await listSkills();
    return {
      count: skills.length,
      skills: skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        tags: skill.tags,
      })),
    };
  }

  const parsed = readSkillSchema.safeParse(input.args ?? {});
  if (!parsed.success) {
    throw new CanvasUpdateError(
      parsed.error.issues[0]?.message ?? "Invalid request body",
      400,
    );
  }

  const detail = await readSkill(parsed.data).catch((error: unknown) => {
    throw toSkillError(error);
  });

  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    tags: detail.tags,
    files: detail.files,
    content: detail.content,
  };
}
