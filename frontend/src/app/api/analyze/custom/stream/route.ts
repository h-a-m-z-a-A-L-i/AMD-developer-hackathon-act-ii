// frontend/src/app/api/analyze/custom/stream/route.ts
// Proxies GET /api/analyze/custom/stream?<params> to the FastAPI backend.
// Must be registered as a concrete route (not under [patientId]) so Next.js
// doesn't capture "custom" as a patientId param and misroute the request.

export async function GET(request: Request) {
  const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";

  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const backendResponse = await fetch(
    `${backendBaseUrl}/api/analyze/custom/stream${queryString}`
  );

  if (!backendResponse.ok) {
    const contentType = backendResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorPayload = await backendResponse.json();
      return Response.json(errorPayload, { status: backendResponse.status });
    }
    return new Response("Failed to reach backend custom stream", { status: 502 });
  }

  if (!backendResponse.body) {
    return new Response("Backend stream returned empty body", { status: 502 });
  }

  return new Response(backendResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
