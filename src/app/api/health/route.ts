// Liveness endpoint for Cloud Run and uptime checks; reveals no configuration.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", service: "kinloop", time: new Date().toISOString() });
}
