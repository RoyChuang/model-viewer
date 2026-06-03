import { NextRequest, NextResponse } from "next/server";
import { statSync, existsSync } from "fs";
import { resolve } from "path";
import { verifyModelToken } from "@/lib/server/modelToken";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
export const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!SAFE_ID.test(id)) {
    return new NextResponse("Invalid model id", { status: 400 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token || !verifyModelToken(token, id)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const filePath = resolve(process.cwd(), "public/models", `${id}.glbenc`);
  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Plaintext size = encrypted file - 12 (IV) - 16 (GCM tag)
  const { size: encryptedSize } = statSync(filePath);
  const totalSize = encryptedSize - 12 - 16;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  return NextResponse.json(
    { totalChunks, chunkSize: CHUNK_SIZE, totalSize },
    { headers: { "Cache-Control": "no-store" } }
  );
}
