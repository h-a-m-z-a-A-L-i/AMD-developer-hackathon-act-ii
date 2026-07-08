// frontend/src/app/api/analyze/custom/validate/route.ts
// Proxies GET /api/analyze/custom/validate?<params> to the FastAPI backend.
// Returns 200 {"valid": true} on success, or 422 with field errors on failure.
// Runs NO pipeline and makes NO LLM calls — pure input validation only.

export async function GET(request: Request) {
  const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";

  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const backendResponse = await fetch(
    `${backendBaseUrl}/api/analyze/custom/validate${queryString}`
  );

  const contentType = backendResponse.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await backendResponse.json();
    return Response.json(payload, { status: backendResponse.status });
  }

  if (!backendResponse.ok) {
    return new Response("Validation endpoint unreachable", { status: 502 });
  }

  return Response.json({ valid: true });
}
