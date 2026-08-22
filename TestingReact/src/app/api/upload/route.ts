import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * @file api/upload/route.ts
 * @description Uploads one image to Cloudflare R2 and returns its public URL.
 *
 * The ONE shared upload path every image entry point in the app calls through
 * `services/upload.ts` — spare-part images and the profile photo alike — so
 * there is exactly one place that knows how to talk to R2, not a one-off per
 * feature.
 *
 * Ported from `src/Apps/ServiceMaintenance/Services/R2CloudStorage/
 * R2StorageService.cs` (the old Blazor project's working integration), into
 * this app rather than modified in place — same bucket, same key format
 * (`{uuid}_{filename}`), same cache-control header, same public URL pattern.
 * The one thing that does NOT carry over is `DisablePayloadSigning`: that
 * flag existed because the old .NET SDK defaulted to a streaming SigV4
 * signature R2 doesn't implement. The JS SDK here is given the whole file as
 * an in-memory `Uint8Array`, not a stream, so it already signs with the
 * plain (non-streaming) algorithm R2 expects — nothing to disable.
 */

export const runtime = "nodejs";

/** Matches `R2StorageConfig.MaxFileSizeBytes` in the old project. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function r2Client(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function POST(req: NextRequest) {
  // Same bar as the other authenticated routes (`ai-search`, the proxy) — an
  // upload spends real R2 storage/bandwidth, so it isn't a public endpoint.
  // This checks presence only, matching how the proxy routes already forward
  // the header without independently re-verifying the JWT.
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "notSignedIn" }, { status: 401 });
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!bucket || !publicBaseUrl) {
    return NextResponse.json({ error: "notConfigured" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalidRequest" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missingFile" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupportedType" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "fileTooLarge" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${crypto.randomUUID()}_${safeName}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const client = r2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000",
      })
    );
  } catch (err) {
    console.error("[api/upload] R2 PutObject failed", err);
    return NextResponse.json({ error: "uploadFailed" }, { status: 502 });
  }

  return NextResponse.json({ url: `${publicBaseUrl}/${key}` });
}
