import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOOLS = [
  {
    name: "canvas_get",
    description:
      "Get canvas summary: nodes, edges, selection, version. Image/video nodes include url, thumbnailUrl, and assetId when available (thumbnailUrl hydrated from MediaAsset).",
    schema: z.object({}),
  },
  {
    name: "canvas_get_node",
    description:
      "Get one node with incoming and outgoing edges. Missing thumbnailUrl is hydrated from MediaAsset via assetId/assetIds when possible.",
    schema: z.object({
      nodeId: z.string().min(1),
    }),
  },
  {
    name: "canvas_search_nodes",
    description:
      "Search nodes by type and/or label/text substring. Results include url/thumbnailUrl/assetId for media nodes when present.",
    schema: z.object({
      type: z
        .enum(["text", "image", "video", "audio", "group"])
        .optional(),
      labelIncludes: z.string().optional(),
    }),
  },
  {
    name: "canvas_add_node",
    description:
      "Add a node to the canvas. For image/video, data may include url (full media), thumbnailUrl (preview), and assetId/assetIds (MediaAsset ids).",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      type: z.enum(["text", "image", "video", "audio", "group"]),
      position: z
        .object({
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      id: z.string().optional(),
    }),
  },
  {
    name: "canvas_update_node",
    description:
      "Update node data, position, or size. For image/video, set data.url, data.thumbnailUrl, and/or data.assetId so the editor can show a preview thumbnail.",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      nodeId: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
      position: z
        .object({
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  },
  {
    name: "canvas_delete_nodes",
    description: "Delete nodes and their connected edges.",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      nodeIds: z.array(z.string().min(1)).min(1),
    }),
  },
  {
    name: "canvas_connect",
    description: "Connect two nodes with a typed edge role.",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      source: z.string().min(1),
      target: z.string().min(1),
      role: z
        .enum([
          "context",
          "prompt",
          "reference_image",
          "first_frame",
          "last_frame",
          "reference_video",
          "reference_audio",
        ])
        .optional(),
      id: z.string().optional(),
    }),
  },
  {
    name: "canvas_disconnect",
    description: "Remove an edge by id or by source/target(/role).",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      edgeId: z.string().optional(),
      source: z.string().optional(),
      target: z.string().optional(),
      role: z
        .enum([
          "context",
          "prompt",
          "reference_image",
          "first_frame",
          "last_frame",
          "reference_video",
          "reference_audio",
        ])
        .optional(),
    }),
  },
  {
    name: "canvas_set_selection",
    description: "Set logical node selection on the canvas.",
    schema: z.object({
      expectedVersion: z.number().int().positive(),
      nodeIds: z.array(z.string()),
    }),
  },
  {
    name: "canvas_run",
    description:
      "Start a server-side generation run (all / selected / from / retry-failed). On success, writes thumbnailUrl when MediaAsset already has one; otherwise enqueues thumbnail generation.",
    schema: z.object({
      mode: z.enum(["all", "selected", "from", "retry-failed"]),
      nodeIds: z.array(z.string().min(1)).optional(),
    }),
  },
  {
    name: "canvas_run_status",
    description: "Get status for a run (or the latest run on this canvas).",
    schema: z.object({
      runId: z.string().min(1).optional(),
    }),
  },
  {
    name: "canvas_run_cancel",
    description: "Cancel a queued or running agent generation run.",
    schema: z.object({
      runId: z.string().min(1),
    }),
  },
];

function readEnvConfig() {
  const baseUrl = (process.env.CANVASE_BASE_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.CANVASE_TOKEN ?? "").trim();
  const canvasId = (process.env.CANVASE_CANVAS_ID ?? "").trim();
  if (!baseUrl || !token || !canvasId) {
    throw new Error(
      "CANVASE_BASE_URL, CANVASE_TOKEN, and CANVASE_CANVAS_ID are required",
    );
  }
  return { baseUrl, token, canvasId };
}

async function callTool(toolName, args) {
  const { baseUrl, token } = readEnvConfig();
  const response = await fetch(`${baseUrl}/api/agent/tools/${toolName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload?.data ?? payload;
}

function asTextResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export async function startCanvaseMcpServer() {
  readEnvConfig();

  const server = new McpServer({
    name: "canvase-canvas",
    version: "0.1.0",
  });

  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.schema.shape, async (args) => {
      try {
        const data = await callTool(tool.name, args);
        return asTextResult(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
