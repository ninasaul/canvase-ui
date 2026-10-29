export function parseStreamFlag(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  try {
    return JSON.parse(trimmed).stream === true;
  } catch {
    return false;
  }
}

export function patchStreamFlag(body: string, stream: boolean): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return JSON.stringify({ stream }, null, 2);
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, stream }, null, 2);
  } catch {
    return body;
  }
}

export function isEventStreamResponse(contentType: string): boolean {
  return contentType.includes("text/event-stream");
}

export async function readResponseStream(
  response: Response,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    onChunk(await response.text());
    return;
  }

  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      onChunk(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) {
      onChunk(tail);
    }
  } finally {
    reader.releaseLock();
  }
}

export function countSseEvents(text: string): number {
  return text.split("\n").filter((line) => line.startsWith("data:")).length;
}
