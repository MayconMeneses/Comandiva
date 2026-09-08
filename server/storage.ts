import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { ENV } from "./_core/env";

function getS3Config() {
  if (!ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) {
    throw new Error("Storage S3 não configurado: defina S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.");
  }
  return {
    bucket: ENV.s3Bucket,
    client: new S3Client({
      region: ENV.s3Region,
      endpoint: ENV.s3Endpoint || undefined,
      forcePathStyle: Boolean(ENV.s3Endpoint),
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
    }),
  };
}

// Evita checar/criar o bucket a cada upload — só na primeira vez do processo.
let bucketReadyPromise: Promise<void> | null = null;

async function ensureBucketExists(bucket: string, client: S3Client) {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      let justCreated = false;
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          justCreated = true;
        } catch (error) {
          const code = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code;
          // Se outro processo já criou o bucket ao mesmo tempo, não é erro.
          if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") throw error;
        }
      }
      if (justCreated) {
        // As imagens (produtos, logo, QR Pix) são servidas por URL pública direta,
        // então o bucket precisa permitir leitura anônima dos objetos.
        try {
          await client.send(new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [{ Effect: "Allow", Principal: "*", Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${bucket}/*`] }],
            }),
          }));
        } catch (error) {
          console.warn("[storage] Não foi possível definir a política pública do bucket automaticamente:", error);
        }
      }
    })().catch(error => {
      bucketReadyPromise = null; // permite tentar de novo na próxima chamada
      throw error;
    });
  }
  return bucketReadyPromise;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1
    ? `${relKey}_${hash}`
    : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function publicS3Url(key: string): string {
  if (!ENV.s3PublicBaseUrl) {
    throw new Error("S3_PUBLIC_BASE_URL é obrigatória para servir assets públicos.");
  }
  return `${ENV.s3PublicBaseUrl.replace(/\/+$/, "")}/${key}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { bucket, client } = getS3Config();
  await ensureBucketExists(bucket, client);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
  return { key, url: publicS3Url(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicS3Url(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const { bucket, client } = getS3Config();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 },
  );
}
