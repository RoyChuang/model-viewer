/**
 * Usage: node scripts/encrypt-model.mjs <input.glb> [output.glbenc]
 *
 * Generates a random AES-256-GCM key and encrypts the GLB file.
 * The key is saved to .env.local as MODEL_ENCRYPTION_KEY (hex-encoded).
 * Format: [IV (12 bytes)][ciphertext + 16-byte GCM tag]
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";
import { createDecipheriv, createCipheriv, randomBytes } from "crypto";
import { resolve, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/encrypt-model.mjs <input.glb> [output.glbenc]");
  process.exit(1);
}

const outputPath =
  process.argv[3] ??
  resolve(root, "public/models", basename(inputPath, ".glb") + ".glbenc");

const plaintext = readFileSync(inputPath);

// Generate or reuse key from .env.local
const envPath = resolve(root, ".env.local");
let keyHex;

if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf8");
  const match = envContent.match(/^MODEL_ENCRYPTION_KEY=([0-9a-f]+)$/m);
  if (match) {
    keyHex = match[1];
    console.log("Reusing existing MODEL_ENCRYPTION_KEY from .env.local");
  }
}

if (!keyHex) {
  keyHex = randomBytes(32).toString("hex");
  appendFileSync(envPath, `\nMODEL_ENCRYPTION_KEY=${keyHex}\n`);
  console.log("Generated new MODEL_ENCRYPTION_KEY — saved to .env.local");
}

const key = Buffer.from(keyHex, "hex");
const iv = randomBytes(12);

const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();

// Write: IV + ciphertext + auth tag
const output = Buffer.concat([iv, encrypted, tag]);
writeFileSync(outputPath, output);

console.log(`Encrypted: ${inputPath}`);
console.log(`Output:    ${outputPath}`);
console.log(`Size:      ${output.length} bytes`);
