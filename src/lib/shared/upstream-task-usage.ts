export type UpstreamTokenUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  promptTextTokens: number | null;
  promptImageTokens: number | null;
  completionTextTokens: number | null;
  completionImageTokens: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function readTokenDetails(
  details: unknown,
): { textTokens: number | null; imageTokens: number | null } {
  if (!isRecord(details)) {
    return { textTokens: null, imageTokens: null };
  }
  return {
    textTokens: asNonNegativeInt(details.text_tokens),
    imageTokens: asNonNegativeInt(details.image_tokens),
  };
}

function readUsageObject(
  usage: Record<string, unknown>,
): UpstreamTokenUsage | null {
  const promptTokens =
    asNonNegativeInt(usage.prompt_tokens) ??
    asNonNegativeInt(usage.input_tokens);
  const completionTokens =
    asNonNegativeInt(usage.completion_tokens) ??
    asNonNegativeInt(usage.output_tokens);
  const totalTokens = asNonNegativeInt(usage.total_tokens);

  const inputDetails = readTokenDetails(
    usage.input_tokens_details ?? usage.prompt_tokens_details,
  );
  const outputDetails = readTokenDetails(
    usage.output_tokens_details ?? usage.completion_tokens_details,
  );

  const hasDetails =
    inputDetails.textTokens !== null ||
    inputDetails.imageTokens !== null ||
    outputDetails.textTokens !== null ||
    outputDetails.imageTokens !== null;

  if (promptTokens !== null || completionTokens !== null || hasDetails) {
    const resolvedPrompt =
      promptTokens ??
      (inputDetails.textTokens !== null || inputDetails.imageTokens !== null
        ? (inputDetails.textTokens ?? 0) + (inputDetails.imageTokens ?? 0)
        : null);
    const resolvedCompletion =
      completionTokens ??
      (outputDetails.textTokens !== null || outputDetails.imageTokens !== null
        ? (outputDetails.textTokens ?? 0) + (outputDetails.imageTokens ?? 0)
        : null);
    return {
      promptTokens: resolvedPrompt,
      completionTokens: resolvedCompletion,
      promptTextTokens: inputDetails.textTokens,
      promptImageTokens: inputDetails.imageTokens,
      completionTextTokens: outputDetails.textTokens,
      completionImageTokens: outputDetails.imageTokens,
    };
  }
  // Upstream video/image often only returns total_tokens — store on completionTokens.
  if (totalTokens !== null) {
    return {
      promptTokens: null,
      completionTokens: totalTokens,
      promptTextTokens: null,
      promptImageTokens: null,
      completionTextTokens: null,
      completionImageTokens: null,
    };
  }
  return null;
}

/**
 * Globally extract token usage from an upstream task / generation response body.
 * Looks at `usage`, `metadata.usage`, `task.usage` (tokenmarket /v2),
 * `data.usage`, and nested New API envelopes (`data.data.usage`).
 */
export function extractUpstreamTaskUsage(
  raw: unknown,
): UpstreamTokenUsage | null {
  if (!isRecord(raw)) {
    return null;
  }

  const candidates: unknown[] = [raw.usage];
  if (isRecord(raw.metadata)) {
    candidates.push(raw.metadata.usage);
  }
  // tokenmarket doubao-sd-max / seedance-max: { task: { usage, metadata.usage } }
  if (isRecord(raw.task)) {
    candidates.push(raw.task.usage);
    if (isRecord(raw.task.metadata)) {
      candidates.push(raw.task.metadata.usage);
    }
  }
  if (isRecord(raw.data)) {
    candidates.push(raw.data.usage);
    if (isRecord(raw.data.metadata)) {
      candidates.push(raw.data.metadata.usage);
    }
    if (isRecord(raw.data.data)) {
      candidates.push(raw.data.data.usage);
    }
  }

  for (const candidate of candidates) {
    if (!isRecord(candidate)) {
      continue;
    }
    const parsed = readUsageObject(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}
