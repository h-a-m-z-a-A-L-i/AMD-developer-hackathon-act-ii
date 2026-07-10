// frontend/src/app/api/providers/select/route.ts
// Proxies POST /api/providers/select to the FastAPI backend. Body is
// { provider: "featherless" | "fireworks" | "amd_notebook" | null } — null
// (or omitted) returns the backend to its normal auto-failover chain.

import { NextResponse } from "next/server";

const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const backendResponse = await fetch(`${backendBaseUrl}/api/providers/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const contentType = backendResponse.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await backendResponse.json();
      return NextResponse.json(payload, { status: backendResponse.status });
    }

    if (!backendResponse.ok) {
      return NextResponse.json(
        { success: false, error: "Provider selection endpoint unreachable." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reach the backend provider selector." },
      { status: 500 }
    );
  }
}
