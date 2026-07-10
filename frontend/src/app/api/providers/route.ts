// frontend/src/app/api/providers/route.ts
// Proxies GET /api/providers to the FastAPI backend. Lists every selectable
// LLM provider (featherless / fireworks / amd_notebook) plus which one, if
// any, is currently manually forced.

import { NextResponse } from "next/server";

const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";

export async function GET() {
  try {
    const backendResponse = await fetch(`${backendBaseUrl}/api/providers`, {
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend providers list returned ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reach the backend providers list." },
      { status: 500 }
    );
  }
}
