// frontend/src/app/api/analyze/[patientId]/stream/route.ts
export async function GET(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";
  
  // Extract and forward any query parameters (critical for custom patient metric validation/streaming)
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();
  const queryString = queryStr ? `?${queryStr}` : "";

  const backendResponse = await fetch(
    `${backendBaseUrl}/api/analyze/${params.patientId}/stream${queryString}`
  );

  if (!backendResponse.ok) {
    // Forward Pydantic/FastAPI 422 validation errors directly to the client
    const contentType = backendResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorPayload = await backendResponse.json();
      return Response.json(errorPayload, { status: backendResponse.status });
    }
    return new Response("Failed to reach backend stream", { status: 502 });
  }

  if (!backendResponse.body) {
    return new Response("Backend stream returned empty body", { status: 502 });
  }

  // Pass through the backend SSE stream to the Next.js client
  return new Response(backendResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
