export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { query, provider = "anthropic" } = await req.json();
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8002";

  let res: Response;
  try {
    res = await fetch(`${backendUrl}/api/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, provider }),
    });
  } catch (err) {
    const msg = `data: ${JSON.stringify({ type: "error", text: `Backend unreachable: ${err}` })}\n\ndata: [DONE]\n\n`;
    return new Response(msg, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  if (!res.ok || !res.body) {
    const msg = `data: ${JSON.stringify({ type: "error", text: `Backend returned HTTP ${res.status}` })}\n\ndata: [DONE]\n\n`;
    return new Response(msg, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const { readable, writable } = new TransformStream();
  res.body.pipeTo(writable).catch(() => {});

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
