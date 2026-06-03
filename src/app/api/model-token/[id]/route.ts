import { NextRequest, NextResponse } from "next/server";
import { createModelToken } from "@/lib/server/modelToken";
import { existsSync } from "fs";
import { resolve } from "path";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!SAFE_ID.test(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  if (!process.env.MODEL_TOKEN_SECRET) {
    return new NextResponse("Not configured", { status: 503 });
  }

  // Only issue tokens for models that actually exist
  const filePath = resolve(process.cwd(), "public/models", `${id}.glbenc`);
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const token = createModelToken(id);

  return NextResponse.json(
    { token, expiresIn: 300 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
