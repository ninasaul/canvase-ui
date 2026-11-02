import { z } from "zod";
import {
  type AgentScope,
  hasAgentScope,
} from "@/lib/agent/agent-scopes";
import type { ResolvedAgentToken } from "@/lib/agent/agent-token";
import {
  CanvasToolMutationError,
  addCanvasNode,
  connectCanvasNodes,
  deleteCanvasNodes,
  groupCanvasNodes,
  ungroupCanvasNode,
  disconnectCanvasNodes,
  getCanvasNodeDetail,
  searchCanvasNodes,
  setCanvasSelection,
  summarizeCanvasGraph,
  updateCanvasNode,
} from "@/lib/agent/canvas-tool-mutations";
import {
  hydrateCanvasGraphThumbnails,
  resolveNodeThumbnailPatch,
} from "@/lib/agent/canvas-thumbnail-resolve";
import {
  cancelCanvasAgentRun,
  getCanvasAgentRun,
  startCanvasAgentRun,
} from "@/lib/agent/canvas-agent-run-service";
import { writeCommandLog } from "@/lib/agent/canvas-command-log";
import {
  SKILL_TOOL_NAMES,
  executeSkillTool,
  isSkillToolName,
  skillToolSchemas,
} from "@/lib/agent/skills-tools";
import {
  CanvasUpdateError,
  applyCanvasGraphUpdate,
  getOwnedActiveCanvas,
  readCanvasGraph,
} from "@/lib/canvas/apply-canvas-graph-update";
import {
  DEFAULT_IMAGE_PARAMS,
  getImageCapabilityProfile,
  toImagePlaygroundModel,
} from "@canvase/generation-params/image";
import {
  DEFAULT_VIDEO_PARAMS,
  getVideoCapabilityProfile,
} from "@canvase/generation-params/video";
import type { CanvasRunMode } from "@/lib/canvas/canvas-dag-runner";
import {
  canvasNodeTypes,
  canvasEdgeRoles,
  type CanvasGraph,
  type CanvasNodeData,
} from "@/lib/canvas/canvas-graph";

export const CANVAS_TOOL_NAMES = [
  "canvas_get",
  "canvas_get_node",
  "canvas_search_nodes",
  "canvas_add_node",
  "canvas_update_node",
  "canvas_delete_nodes",
  "canvas_connect",
  "canvas_disconnect",
  "canvas_set_selection",
  "canvas_run",
  "canvas_run_status",
  "canvas_run_cancel",
  "canvas_group_nodes",
  "canvas_ungroup",
  "canvas_generation_options",
] as const;

export type CanvasToolName = (typeof CANVAS_TOOL_NAMES)[number];

export function isCanvasToolName(value: string): value is CanvasToolName {
  return (CANVAS_TOOL_NAMES as readonly string[]).includes(value);
}

/** Canvas tools plus filesystem-backed skill tools, in catalog order. */
export const AGENT_TOOL_NAMES = [
  ...CANVAS_TOOL_NAMES,
  ...SKILL_TOOL_NAMES,
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export function isAgentToolName(value: string): value is AgentToolName {
  return (AGENT_TOOL_NAMES as readonly string[]).includes(value);
}

const TOOL_SCOPES: Record<AgentToolName, AgentScope> = {
  canvas_get: "canvas:read",
  canvas_get_node: "canvas:read",
  canvas_search_nodes: "canvas:read",
  canvas_add_node: "canvas:edit",
  canvas_update_node: "canvas:edit",
  canvas_delete_nodes: "canvas:edit",
  canvas_connect: "canvas:edit",
  canvas_disconnect: "canvas:edit",
  canvas_set_selection: "canvas:edit",
  canvas_run: "canvas:run",
  canvas_run_status: "canvas:run",
  canvas_run_cancel: "canvas:run",
  canvas_group_nodes: "canvas:edit",
  canvas_ungroup: "canvas:edit",
  canvas_generation_options: "canvas:read",
  // Skills are read-only instructions; any canvas reader may load them.
  skills_list: "canvas:read",
  skills_read: "canvas:read",
};

export const canvasToolSchemas: Record<
  AgentToolName,
  { description: string; inputSchema: Record<string, unknown> }
> = {
  ...skillToolSchemas,
  canvas_get: {
    description:
      "Get canvas summary: nodes, edges, selection, version. Image/video nodes include url, thumbnailUrl, and assetId when available (thumbnailUrl is hydrated from MediaAsset).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  canvas_get_node: {
    description:
      "Get one node with incoming and outgoing edges. Missing thumbnailUrl is hydrated from MediaAsset via assetId/assetIds when possible.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
      },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  canvas_search_nodes: {
    description:
      "Search nodes by type and/or label/text substring. Results include url/thumbnailUrl/assetId for media nodes when present.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...canvasNodeTypes] },
        labelIncludes: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  canvas_add_node: {
    description:
      "Add a node to the canvas. For image/video, data may include url (full media), thumbnailUrl (preview), and assetId/assetIds (MediaAsset ids for hydration).",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        type: { type: "string", enum: [...canvasNodeTypes] },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        data: { type: "object", additionalProperties: true },
        width: { type: "number" },
        height: { type: "number" },
        id: { type: "string" },
      },
      required: ["expectedVersion", "type"],
      additionalProperties: false,
    },
  },
  canvas_update_node: {
    description:
      "Update node data, position, or size. For image/video, set data.url, data.thumbnailUrl, and/or data.assetId so the editor can show a preview thumbnail.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        nodeId: { type: "string" },
        data: { type: "object", additionalProperties: true },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
        },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["expectedVersion", "nodeId"],
      additionalProperties: false,
    },
  },
  canvas_delete_nodes: {
    description: "Delete nodes and their connected edges.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        nodeIds: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
        },
      },
      required: ["expectedVersion", "nodeIds"],
      additionalProperties: false,
    },
  },
  canvas_connect: {
    description: "Connect two nodes with a typed edge role.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        source: { type: "string" },
        target: { type: "string" },
        role: { type: "string", enum: [...canvasEdgeRoles] },
        id: { type: "string" },
      },
      required: ["expectedVersion", "source", "target"],
      additionalProperties: false,
    },
  },
  canvas_disconnect: {
    description: "Remove an edge by id or by source/target(/role).",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        edgeId: { type: "string" },
        source: { type: "string" },
        target: { type: "string" },
        role: { type: "string", enum: [...canvasEdgeRoles] },
      },
      required: ["expectedVersion"],
      additionalProperties: false,
    },
  },
  canvas_set_selection: {
    description: "Set logical node selection on the canvas.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "integer" },
        nodeIds: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["expectedVersion", "nodeIds"],
      additionalProperties: false,
    },
  },
  canvas_run: {
    description:
      "Start a server-side generation run (all / selected / node / from / retry-failed). `node` runs only the given nodes and skips upstream; a group id expands to its children. On success, writes thumbnailUrl onto image/video nodes when the MediaAsset already has one; otherwise enqueues thumbnail generation.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["all", "selected", "node", "from", "retry-failed"],
        },
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "Required for selected/from modes.",
        },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  canvas_run_status: {
    description: "Get status for a run (or the latest run on this canvas).",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  canvas_group_nodes: {
    description:
      "Wrap existing root-level nodes in a new group sized to their bounding box. Children keep their on-screen position and become group-relative. Use canvas_get first for the current expectedVersion.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "number" },
        nodeIds: { type: "array", items: { type: "string" } },
        label: { type: "string" },
        id: { type: "string" },
      },
      required: ["expectedVersion", "nodeIds"],
      additionalProperties: false,
    },
  },
  canvas_ungroup: {
    description:
      "Dissolve a group: children are released back to absolute positions and the group node is removed.",
    inputSchema: {
      type: "object",
      properties: {
        expectedVersion: { type: "number" },
        groupId: { type: "string" },
      },
      required: ["expectedVersion", "groupId"],
      additionalProperties: false,
    },
  },
  canvas_generation_options: {
    description:
      "Read the generation settings of an image/video node: current model, current params, defaults, and the allowed values (sizes/aspect ratios/quality for images; ratios/resolutions/duration for video). Call before canvas_update_node when changing params.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
      },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  canvas_run_cancel: {
    description: "Cancel a queued or running agent generation run.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
      },
      required: ["runId"],
      additionalProperties: false,
    },
  },
};

/** Reads dominate tool traffic; only persist audit rows for writes and skills. */
const READ_ONLY_TOOLS = new Set<AgentToolName>([
  "canvas_get",
  "canvas_get_node",
  "canvas_search_nodes",
]);

async function logToolCall(
  input: Parameters<typeof writeCommandLog>[0],
): Promise<void> {
  if (READ_ONLY_TOOLS.has(input.tool as AgentToolName)) {
    return;
  }
  await writeCommandLog(input);
}

async function commitGraphEdit(input: {
  canvasId: string;
  ownerId: string;
  actorType: "user" | "agent";
  actorId: string;
  tool: CanvasToolName;
  args: unknown;
  expectedVersion: number;
  mutate: (graph: CanvasGraph) => { graph: CanvasGraph; result: unknown };
}) {
  const canvas = await getOwnedActiveCanvas(input.canvasId, input.ownerId);
  if (!canvas) {
    throw new CanvasUpdateError("Canvas not found", 404);
  }
  const current = readCanvasGraph(canvas);
  const mutated = input.mutate(current);
  const applied = await applyCanvasGraphUpdate({
    canvasId: input.canvasId,
    ownerId: input.ownerId,
    expectedVersion: input.expectedVersion,
    graph: mutated.graph,
  });
  const payload = {
    version: applied.versionAfter,
    ...(mutated.result as object),
  };
  await logToolCall({
    canvasId: input.canvasId,
    actorType: input.actorType,
    actorId: input.actorId,
    tool: input.tool,
    args: input.args,
    result: payload,
    versionBefore: applied.versionBefore,
    versionAfter: applied.versionAfter,
  });
  return payload;
}

const addNodeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  type: z.enum(canvasNodeTypes),
  position: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
    })
    .optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  id: z.string().trim().min(1).max(120).optional(),
  parentId: z.string().trim().min(1).max(120).nullable().optional(),
});

const updateNodeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nodeId: z.string().trim().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  position: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
    })
    .optional(),
  width: z.number().finite().positive().optional(),
  height: z.number().finite().positive().optional(),
  parentId: z.string().trim().min(1).max(120).nullable().optional(),
});

const deleteNodesSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nodeIds: z.array(z.string().trim().min(1)).min(1),
});

const connectSchema = z.object({
  expectedVersion: z.number().int().positive(),
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  role: z.enum(canvasEdgeRoles).optional(),
  id: z.string().trim().min(1).max(120).optional(),
});

const disconnectSchema = z.object({
  expectedVersion: z.number().int().positive(),
  edgeId: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  target: z.string().trim().min(1).optional(),
  role: z.enum(canvasEdgeRoles).optional(),
});

const selectionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nodeIds: z.array(z.string().trim().min(1)),
});

const getNodeSchema = z.object({
  nodeId: z.string().trim().min(1),
});

const searchSchema = z.object({
  type: z.enum(canvasNodeTypes).optional(),
  labelIncludes: z.string().optional(),
});

const runModes = ["all", "selected", "node", "from", "retry-failed"] as const;

const runSchema = z.object({
  mode: z.enum(runModes),
  nodeIds: z.array(z.string().trim().min(1)).optional(),
});

const runStatusSchema = z.object({
  runId: z.string().trim().min(1).optional(),
});

const groupNodesSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nodeIds: z.array(z.string().trim().min(1)).min(1),
  label: z.string().trim().max(80).optional(),
  id: z.string().trim().min(1).max(120).optional(),
});

const ungroupSchema = z.object({
  expectedVersion: z.number().int().positive(),
  groupId: z.string().trim().min(1),
});

const generationOptionsSchema = z.object({
  nodeId: z.string().trim().min(1),
});

const runCancelSchema = z.object({
  runId: z.string().trim().min(1),
});

/**
 * Compact description of what a media node can be told to generate, so the
 * model does not have to guess param keys or enum values.
 */
function describeGenerationOptions(node: {
  type: string;
  data: CanvasNodeData;
}): Record<string, unknown> {
  if (node.type !== "image" && node.type !== "video") {
    return {
      supported: false,
      hint: "Only image and video nodes accept generation params.",
    };
  }
  const model = node.data.model?.trim() ?? "";
  const vendor = node.data.vendor?.trim() ?? "";
  const current =
    node.data.params && typeof node.data.params === "object"
      ? (node.data.params as Record<string, unknown>)
      : {};
  if (!model) {
    return {
      supported: true,
      capability: node.type,
      model: null,
      current,
      hint: "Set data.model (and data.vendor) on the node before setting params.",
    };
  }
  if (node.type === "image") {
    const profile = getImageCapabilityProfile(
      toImagePlaygroundModel({ id: model, vendor }),
    );
    return {
      supported: true,
      capability: "image",
      model,
      vendor,
      current,
      defaults: DEFAULT_IMAGE_PARAMS,
      allowed: {
        size: profile.sizes,
        aspectRatio: profile.aspectRatios,
        count: { min: 1, max: profile.maxCount },
        quality: profile.qualityOptions,
        background: profile.backgroundOptions,
        moderation: profile.moderationOptions,
        responseFormat: ["url", "b64_json"],
      },
      notes: [
        profile.allowCustomSize
          ? "size may also be a custom token like 1024x1024"
          : "use one of the allowed size tokens",
        "Pass params through canvas_update_node data.params; keys are merged.",
      ],
    };
  }
  const profile = getVideoCapabilityProfile(model);
  return {
    supported: true,
    capability: "video",
    model,
    vendor,
    current,
    defaults: DEFAULT_VIDEO_PARAMS,
    allowed: {
      ratio: profile.ratios,
      resolution: profile.resolutions,
      duration: profile.duration,
      generateAudio: profile.showGenerateAudio,
      watermark: profile.showWatermark,
      cameraFixed: profile.showCameraFixed,
      draftMode: profile.showDraftMode,
      klingMode: profile.showKlingMode,
    },
    notes: [
      "lockedResolution/lockedDuration mean the model ignores that param.",
      "Pass params through canvas_update_node data.params; keys are merged.",
    ],
  };
}

export type ToolActor =
  | { kind: "agent"; token: ResolvedAgentToken }
  | { kind: "user"; userId: string; canvasId: string };

export async function executeCanvasTool(input: {
  tool: AgentToolName;
  args: unknown;
  actor: ToolActor;
}): Promise<unknown> {
  const canvasId =
    input.actor.kind === "agent"
      ? input.actor.token.canvasId
      : input.actor.canvasId;
  const ownerId =
    input.actor.kind === "agent"
      ? input.actor.token.ownerId
      : input.actor.userId;
  const scopes =
    input.actor.kind === "agent"
      ? input.actor.token.scopes
      : ["canvas:read", "canvas:edit", "canvas:run"];
  const required = TOOL_SCOPES[input.tool];
  if (!hasAgentScope(scopes, required)) {
    throw new CanvasUpdateError(`Missing scope: ${required}`, 403);
  }

  const actorType = input.actor.kind === "agent" ? "agent" : "user";
  const actorId =
    input.actor.kind === "agent" ? input.actor.token.id : input.actor.userId;

  // Skill tools are canvas-independent: no graph read, no version bump.
  if (isSkillToolName(input.tool)) {
    const data = await executeSkillTool({
      tool: input.tool,
      args: input.args,
    });
    await logToolCall({
      canvasId,
      actorType,
      actorId,
      tool: input.tool,
      args: input.args ?? {},
      result:
        input.tool === "skills_list"
          ? { count: (data as { count?: number }).count ?? 0 }
          : { id: (data as { id?: string }).id ?? null },
      versionBefore: 0,
      versionAfter: 0,
    });
    return data;
  }

  try {
    switch (input.tool) {
      case "canvas_get": {
        const canvas = await getOwnedActiveCanvas(canvasId, ownerId);
        if (!canvas) {
          throw new CanvasUpdateError("Canvas not found", 404);
        }
        const graph = await hydrateCanvasGraphThumbnails(
          ownerId,
          readCanvasGraph(canvas),
        );
        const data = summarizeCanvasGraph(canvas.title, canvas.version, graph);
        await logToolCall({
          canvasId,
          actorType,
          actorId,
          tool: input.tool,
          args: input.args ?? {},
          result: data,
          versionBefore: canvas.version,
          versionAfter: canvas.version,
        });
        return data;
      }
      case "canvas_get_node": {
        const parsed = getNodeSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const canvas = await getOwnedActiveCanvas(canvasId, ownerId);
        if (!canvas) {
          throw new CanvasUpdateError("Canvas not found", 404);
        }
        const graph = await hydrateCanvasGraphThumbnails(
          ownerId,
          readCanvasGraph(canvas),
        );
        const data = getCanvasNodeDetail(graph, parsed.data.nodeId);
        await logToolCall({
          canvasId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          result: data,
          versionBefore: canvas.version,
          versionAfter: canvas.version,
        });
        return data;
      }
      case "canvas_search_nodes": {
        const parsed = searchSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const canvas = await getOwnedActiveCanvas(canvasId, ownerId);
        if (!canvas) {
          throw new CanvasUpdateError("Canvas not found", 404);
        }
        const graph = await hydrateCanvasGraphThumbnails(
          ownerId,
          readCanvasGraph(canvas),
        );
        const nodes = searchCanvasNodes(graph, parsed.data);
        const data = { nodes, version: canvas.version };
        await logToolCall({
          canvasId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          result: data,
          versionBefore: canvas.version,
          versionAfter: canvas.version,
        });
        return data;
      }
      case "canvas_add_node": {
        const parsed = addNodeSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const nodeData = {
          ...((parsed.data.data ?? {}) as Partial<CanvasNodeData>),
        };
        if (
          parsed.data.type === "image" ||
          parsed.data.type === "video"
        ) {
          Object.assign(
            nodeData,
            await resolveNodeThumbnailPatch(ownerId, nodeData),
          );
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const { graph: next, node } = addCanvasNode(graph, {
              type: parsed.data.type,
              position: parsed.data.position,
              data: nodeData,
              width: parsed.data.width,
              height: parsed.data.height,
              id: parsed.data.id,
              parentId: parsed.data.parentId,
            });
            return { graph: next, result: { node } };
          },
        });
      }
      case "canvas_update_node": {
        const parsed = updateNodeSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const nodeData = parsed.data.data
          ? {
              ...(parsed.data.data as Partial<CanvasNodeData>),
            }
          : undefined;
        if (nodeData) {
          Object.assign(
            nodeData,
            await resolveNodeThumbnailPatch(ownerId, nodeData),
          );
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const { graph: next, node } = updateCanvasNode(graph, {
              nodeId: parsed.data.nodeId,
              data: nodeData,
              position: parsed.data.position,
              width: parsed.data.width,
              height: parsed.data.height,
              parentId: parsed.data.parentId,
            });
            return { graph: next, result: { node } };
          },
        });
      }
      case "canvas_group_nodes": {
        const parsed = groupNodesSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError(
            parsed.error.issues[0]?.message ?? "Invalid request body",
            400,
          );
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const { graph: next, group } = groupCanvasNodes(graph, {
              nodeIds: parsed.data.nodeIds,
              label: parsed.data.label,
              id: parsed.data.id,
            });
            return { graph: next, result: { group } };
          },
        });
      }
      case "canvas_ungroup": {
        const parsed = ungroupSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const { graph: next, releasedNodeIds } = ungroupCanvasNode(
              graph,
              parsed.data.groupId,
            );
            return { graph: next, result: { releasedNodeIds } };
          },
        });
      }
      case "canvas_generation_options": {
        const parsed = generationOptionsSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const canvas = await getOwnedActiveCanvas(canvasId, ownerId);
        if (!canvas) {
          throw new CanvasUpdateError("Canvas not found", 404);
        }
        const graph = readCanvasGraph(canvas);
        const node = graph.nodes.find((item) => item.id === parsed.data.nodeId);
        if (!node) {
          throw new CanvasUpdateError(
            `Node not found: ${parsed.data.nodeId}`,
            404,
          );
        }
        const data = describeGenerationOptions(node);
        await logToolCall({
          canvasId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          result: { model: (data as { model?: string }).model ?? null },
          versionBefore: canvas.version,
          versionAfter: canvas.version,
        });
        return data;
      }
      case "canvas_delete_nodes": {
        const parsed = deleteNodesSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const result = deleteCanvasNodes(graph, parsed.data.nodeIds);
            return {
              graph: result.graph,
              result: {
                deletedNodeIds: result.deletedNodeIds,
                deletedEdgeIds: result.deletedEdgeIds,
              },
            };
          },
        });
      }
      case "canvas_connect": {
        const parsed = connectSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const { graph: next, edge } = connectCanvasNodes(graph, parsed.data);
            return { graph: next, result: { edge } };
          },
        });
      }
      case "canvas_disconnect": {
        const parsed = disconnectSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const result = disconnectCanvasNodes(graph, parsed.data);
            return {
              graph: result.graph,
              result: { removedEdgeIds: result.removedEdgeIds },
            };
          },
        });
      }
      case "canvas_set_selection": {
        const parsed = selectionSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        return commitGraphEdit({
          canvasId,
          ownerId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          expectedVersion: parsed.data.expectedVersion,
          mutate: (graph) => {
            const result = setCanvasSelection(graph, parsed.data.nodeIds);
            return {
              graph: result.graph,
              result: { selection: result.selection },
            };
          },
        });
      }
      case "canvas_run": {
        const parsed = runSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const canvas = await getOwnedActiveCanvas(canvasId, ownerId);
        if (!canvas) {
          throw new CanvasUpdateError("Canvas not found", 404);
        }
        try {
          const data = await startCanvasAgentRun({
            canvasId,
            ownerId,
            mode: parsed.data.mode as CanvasRunMode,
            nodeIds: parsed.data.nodeIds,
          });
          await logToolCall({
            canvasId,
            actorType,
            actorId,
            tool: input.tool,
            args: parsed.data,
            result: data,
            versionBefore: canvas.version,
            versionAfter: canvas.version,
          });
          return data;
        } catch (error) {
          throw new CanvasUpdateError(
            error instanceof Error ? error.message : "Run failed",
            400,
          );
        }
      }
      case "canvas_run_status": {
        const parsed = runStatusSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        const data = await getCanvasAgentRun({
          canvasId,
          ownerId,
          runId: parsed.data.runId,
        });
        if (!data) {
          throw new CanvasUpdateError("Run not found", 404);
        }
        await logToolCall({
          canvasId,
          actorType,
          actorId,
          tool: input.tool,
          args: parsed.data,
          result: data,
          versionBefore: 0,
          versionAfter: 0,
        });
        return data;
      }
      case "canvas_run_cancel": {
        const parsed = runCancelSchema.safeParse(input.args ?? {});
        if (!parsed.success) {
          throw new CanvasUpdateError("Invalid request body", 400);
        }
        try {
          const data = await cancelCanvasAgentRun({
            canvasId,
            ownerId,
            runId: parsed.data.runId,
          });
          await logToolCall({
            canvasId,
            actorType,
            actorId,
            tool: input.tool,
            args: parsed.data,
            result: data,
            versionBefore: 0,
            versionAfter: 0,
          });
          return data;
        } catch (error) {
          throw new CanvasUpdateError(
            error instanceof Error ? error.message : "Cancel failed",
            404,
          );
        }
      }
      default: {
        throw new CanvasUpdateError("Unknown tool", 404);
      }
    }
  } catch (error) {
    if (error instanceof CanvasToolMutationError) {
      throw new CanvasUpdateError(error.message, 400);
    }
    throw error;
  }
}
