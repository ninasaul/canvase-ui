import { Prisma } from "@prisma/client";
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
import {
  CanvasUpdateError,
  applyCanvasGraphUpdate,
  getOwnedActiveCanvas,
  readCanvasGraph,
} from "@/lib/canvas/apply-canvas-graph-update";
import type { CanvasRunMode } from "@/lib/canvas/canvas-dag-runner";
import {
  canvasNodeTypes,
  canvasEdgeRoles,
  type CanvasGraph,
  type CanvasNodeData,
} from "@/lib/canvas/canvas-graph";
import { prisma } from "@/lib/prisma";

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
] as const;

export type CanvasToolName = (typeof CANVAS_TOOL_NAMES)[number];

export function isCanvasToolName(value: string): value is CanvasToolName {
  return (CANVAS_TOOL_NAMES as readonly string[]).includes(value);
}

const TOOL_SCOPES: Record<CanvasToolName, AgentScope> = {
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
};

export const canvasToolSchemas: Record<
  CanvasToolName,
  { description: string; inputSchema: Record<string, unknown> }
> = {
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
      "Start a server-side generation run (all / selected / from / retry-failed). On success, writes thumbnailUrl onto image/video nodes when the MediaAsset already has one; otherwise enqueues thumbnail generation.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["all", "selected", "from", "retry-failed"],
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

async function writeCommandLog(input: {
  canvasId: string;
  actorType: "user" | "agent";
  actorId: string;
  tool: string;
  args: unknown;
  result: unknown;
  versionBefore: number;
  versionAfter: number;
}) {
  await prisma.canvasCommandLog.create({
    data: {
      canvasId: input.canvasId,
      actorType: input.actorType,
      actorId: input.actorId,
      tool: input.tool,
      input: input.args as Prisma.InputJsonValue,
      result: input.result as Prisma.InputJsonValue,
      versionBefore: input.versionBefore,
      versionAfter: input.versionAfter,
    },
  });
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
  await writeCommandLog({
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

const runModes = ["all", "selected", "from", "retry-failed"] as const;

const runSchema = z.object({
  mode: z.enum(runModes),
  nodeIds: z.array(z.string().trim().min(1)).optional(),
});

const runStatusSchema = z.object({
  runId: z.string().trim().min(1).optional(),
});

const runCancelSchema = z.object({
  runId: z.string().trim().min(1),
});

export type ToolActor =
  | { kind: "agent"; token: ResolvedAgentToken }
  | { kind: "user"; userId: string; canvasId: string };

export async function executeCanvasTool(input: {
  tool: CanvasToolName;
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
        await writeCommandLog({
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
        await writeCommandLog({
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
        await writeCommandLog({
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
            });
            return { graph: next, result: { node } };
          },
        });
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
          await writeCommandLog({
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
        await writeCommandLog({
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
          await writeCommandLog({
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
