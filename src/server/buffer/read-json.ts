// Measure the bytes actually read, even when the length header is absent or compressed.
export async function readBoundedJson(response: Response, limit: number): Promise<unknown> {
  const body = response.body;
  if (!body) throw new Error('The response body was missing.');

  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > limit) {
    void body.cancel().catch(() => {});
    throw new Error('The response exceeded its byte limit.');
  }

  const reader = body.getReader();
  let bytes = new Uint8Array(Math.min(4096, limit));
  let length = 0;
  let finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        finished = true;
        break;
      }
      const nextLength = length + value.byteLength;
      if (nextLength > limit) throw new Error('The response exceeded its byte limit.');
      if (nextLength > bytes.byteLength) {
        const expanded = new Uint8Array(Math.min(limit, Math.max(nextLength, bytes.byteLength * 2)));
        expanded.set(bytes.subarray(0, length));
        bytes = expanded;
      }
      bytes.set(value, length);
      length = nextLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
  } finally {
    if (!finished) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
