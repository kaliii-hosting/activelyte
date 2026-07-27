// Small helpers shared by admin Route Handlers: a typed HTTP error and a
// wrapper that turns thrown errors into clean JSON responses.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Run a handler, mapping HttpError -> its status and anything else -> 500.
// Never leaks internal error text to the client on a 500.
export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return json({ error: err.message }, err.status);
    }
    console.error("[admin api] unhandled error:", err);
    return json({ error: "Internal error" }, 500);
  }
}
