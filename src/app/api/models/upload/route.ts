import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, extname, resolve } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  parseViewerModelsConfig,
  type ViewerModelConfig,
} from "@/lib/modelConfigs";
import { encryptModelBuffer, isGlbBuffer } from "@/lib/server/modelEncryption";

export const runtime = "nodejs";

const SAFE_ID = /^[a-zA-Z0-9_-]+$/;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function sanitizeModelId(value: string) {
  return value
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function readViewerModelsConfig(configPath: string): Promise<ViewerModelConfig[]> {
  if (!existsSync(configPath)) return [];

  const raw = await readFile(configPath, "utf8");
  if (raw.trim().length === 0) return [];

  return parseViewerModelsConfig(JSON.parse(raw));
}

export async function POST(req: NextRequest) {
  const keyHex = process.env.MODEL_ENCRYPTION_KEY;
  if (!keyHex) return jsonError("MODEL_ENCRYPTION_KEY is not configured", 503);

  const form = await req.formData();
  const file = form.get("file");
  const requestedId = form.get("modelId");
  const requestedLabel = form.get("label");

  if (!(file instanceof File)) {
    return jsonError("Missing GLB file", 400);
  }

  if (!file.name.toLowerCase().endsWith(".glb")) {
    return jsonError("Only .glb files are allowed", 400);
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return jsonError("File size must be between 1 byte and 100 MB", 400);
  }

  const fallbackId = sanitizeModelId(basename(file.name, extname(file.name)));
  const modelId =
    typeof requestedId === "string" && requestedId.trim().length > 0
      ? sanitizeModelId(requestedId)
      : fallbackId;

  if (!SAFE_ID.test(modelId)) {
    return jsonError("modelId must contain only letters, numbers, '_' or '-'", 400);
  }

  const label =
    typeof requestedLabel === "string" && requestedLabel.trim().length > 0
      ? requestedLabel.trim()
      : modelId;

  const plaintext = Buffer.from(await file.arrayBuffer());
  if (!isGlbBuffer(plaintext)) {
    return jsonError("Uploaded file is not a valid GLB binary", 400);
  }

  let encrypted: Buffer;
  try {
    encrypted = encryptModelBuffer(plaintext, keyHex);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(message, 503);
  }

  const modelsDir = resolve(process.cwd(), "public/models");
  const configPath = resolve(process.cwd(), "public/config/viewer-models.json");
  const outputPath = resolve(modelsDir, `${modelId}.glbenc`);

  await mkdir(modelsDir, { recursive: true });
  await mkdir(resolve(process.cwd(), "public/config"), { recursive: true });
  await writeFile(outputPath, encrypted);

  const models = await readViewerModelsConfig(configPath);
  const existingIndex = models.findIndex((model) => model.id === modelId);
  const nextModel = { id: modelId, label };

  if (existingIndex >= 0) {
    models[existingIndex] = nextModel;
  } else {
    models.push(nextModel);
  }

  await writeFile(configPath, `${JSON.stringify(models, null, 2)}\n`);

  return NextResponse.json({
    encryptedSize: encrypted.length,
    id: modelId,
    label,
    sourceSize: plaintext.length,
  });
}
