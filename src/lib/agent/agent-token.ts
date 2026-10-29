import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  AGENT_P0_SCOPES,
  type AgentScope,
  isAgentScope,
} from "@/lib/agent/agent-scopes";

export type ResolvedAgentToken = {
  id: string;
  ownerId: string;
  canvasId: string;
  scopes: string[];
  label: string;
  expiresAt: Date;
};

export function hashAgentToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateAgentTokenPlaintext(): string {
  return `cvs_${randomBytes(32).toString("base64url")}`;
}

export function normalizeAgentScopes(scopes: string[]): AgentScope[] {
  const unique = new Set<AgentScope>();
  for (const scope of scopes) {
    if (isAgentScope(scope)) {
      unique.add(scope);
    }
  }
  if (unique.size === 0) {
    return [...AGENT_P0_SCOPES];
  }
  return [...unique];
}

export async function createAgentToken(input: {
  ownerId: string;
  canvasId: string;
  scopes?: string[];
  label?: string;
  ttlHours?: number;
}): Promise<{
  token: ResolvedAgentToken & { plaintext: string };
}> {
  const scopes = normalizeAgentScopes(input.scopes ?? AGENT_P0_SCOPES);
  const ttlHours = Math.min(
    Math.max(input.ttlHours ?? 24, 1),
    24 * 30,
  );
  const plaintext = generateAgentTokenPlaintext();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const row = await prisma.agentToken.create({
    data: {
      ownerId: input.ownerId,
      canvasId: input.canvasId,
      tokenHash: hashAgentToken(plaintext),
      label: (input.label ?? "").trim().slice(0, 120),
      scopes,
      expiresAt,
    },
  });
  return {
    token: {
      id: row.id,
      ownerId: row.ownerId,
      canvasId: row.canvasId,
      scopes: row.scopes,
      label: row.label,
      expiresAt: row.expiresAt,
      plaintext,
    },
  };
}

export async function listAgentTokens(input: {
  ownerId: string;
  canvasId: string;
}) {
  const rows = await prisma.agentToken.findMany({
    where: {
      ownerId: input.ownerId,
      canvasId: input.canvasId,
    },
    orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    scopes: row.scopes,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    active:
      !row.revokedAt && row.expiresAt.getTime() > now,
  }));
}

export async function revokeAgentToken(input: {
  ownerId: string;
  tokenId: string;
}): Promise<boolean> {
  const existing = await prisma.agentToken.findFirst({
    where: {
      id: input.tokenId,
      ownerId: input.ownerId,
    },
  });
  if (!existing) {
    return false;
  }
  if (existing.revokedAt) {
    return true;
  }
  await prisma.agentToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  return true;
}

export async function resolveAgentTokenFromBearer(
  authorizationHeader: string | null,
): Promise<ResolvedAgentToken | null> {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) {
    return null;
  }
  const plaintext = match[1]?.trim();
  if (!plaintext) {
    return null;
  }
  const row = await prisma.agentToken.findUnique({
    where: { tokenHash: hashAgentToken(plaintext) },
  });
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  await prisma.agentToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return {
    id: row.id,
    ownerId: row.ownerId,
    canvasId: row.canvasId,
    scopes: row.scopes,
    label: row.label,
    expiresAt: row.expiresAt,
  };
}

export function buildMcpConfigSnippet(input: {
  baseUrl: string;
  token: string;
  canvasId: string;
}): {
  mcpServers: {
    "canvase-canvas": {
      command: string;
      args: string[];
      env: Record<string, string>;
    };
  };
} {
  return {
    mcpServers: {
      "canvase-canvas": {
        // Resolve from the canvase-ui repo root (Codex / Cursor MCP cwd).
        command: "node",
        args: ["./packages/canvase-mcp/src/cli.js"],
        env: {
          CANVASE_BASE_URL: input.baseUrl.replace(/\/$/, ""),
          CANVASE_TOKEN: input.token,
          CANVASE_CANVAS_ID: input.canvasId,
        },
      },
    },
  };
}
