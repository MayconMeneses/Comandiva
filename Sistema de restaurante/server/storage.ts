import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ENV } from "./_core/env";

// Mapa "tipo declarado no upload" → formato real que o sharp precisa
// detectar nos bytes pra bater. Cobre os tipos aceitos pelos 6 endpoints de
// upload de imagem do projeto (ver assertRealImageMatchesDeclaredType).
const MIME_TO_SHARP_FORMAT: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "heif", // sharp reporta AVIF como "heif" (mesmo container ISOBMFF)
};

/**
 * Confere que os BYTES reais do arquivo batem com o Content-Type que o
 * cliente declarou — até aqui, todo endpoint de upload só validava um enum
 * Zod (o que o cliente *diz* que está enviando), nunca o conteúdo em si (ver
 * auditoria V-35). Sozinho isso não é um vetor de XSS direto (o navegador
 * não executa um Content-Type declarado como imagem), mas fecha o bucket
 * como hospedagem de arquivo arbitrário disfarçado de imagem.
 */
export async function assertRealImageMatchesDeclaredType(bytes: Buffer, declaredContentType: string): Promise<void> {
  const expectedFormat = MIME_TO_SHARP_FORMAT[declaredContentType];
  if (!expectedFormat) throw new TRPCError({ code: "BAD_REQUEST", message: `Tipo de imagem não suportado: ${declaredContentType}.` });
  let detectedFormat: string | undefined;
  try {
    detectedFormat = (await sharp(bytes).metadata()).format;
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo enviado não é uma imagem válida." });
  }
  if (detectedFormat !== expectedFormat) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `O arquivo enviado não é realmente do tipo ${declaredContentType} (detectado: ${detectedFormat ?? "desconhecido"}).` });
  }
}

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

// Só esses dois prefixos são de fato pra qualquer visitante ver (cardápio,
// categorias, eventos, logo, QR Pix) — nunca o bucket inteiro. Em especial,
// orders/* (comprovante/anexo de pedido, mostrado só dentro do admin
// autenticado) fica de fora de propósito e é servido por URL assinada
// (storageGetSignedUrl) via admin.getAttachmentSignedUrl, nunca por link
// permanente. Reaplicada em todo boot (não só na criação) pra uma mudança
// de política chegar em produção só com o próximo deploy, sem precisar de
// um passo manual separado.
const PUBLIC_READ_PREFIXES = ["catalog/*", "branding/*"];

async function ensureBucketExists(bucket: string, client: S3Client) {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (error) {
          const code = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code;
          // Se outro processo já criou o bucket ao mesmo tempo, não é erro.
          if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") throw error;
        }
      }
      try {
        await client.send(new PutBucketPolicyCommand({
          Bucket: bucket,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"],
              Resource: PUBLIC_READ_PREFIXES.map(prefix => `arn:aws:s3:::${bucket}/${prefix}`),
            }],
          }),
        }));
      } catch (error) {
        console.warn("[storage] Não foi possível definir a política pública do bucket automaticamente:", error);
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

/**
 * Garante bucket criado + política pública aplicada já na inicialização do
 * servidor — antes disso, isso só rodava no primeiro storagePut() depois de
 * cada boot, o que na prática significa "só quando alguém faz upload".
 * Um restart sem nenhum upload no meio tempo deixava a política antiga
 * (mais permissiva, de antes de um fix) valendo indefinidamente, mesmo com
 * o código já corrigido — exatamente o que aconteceu na auditoria de hoje.
 * Silenciosa se S3 não estiver configurado (ambiente sem storage).
 */
export async function ensureStorageReady(): Promise<void> {
  if (!ENV.s3Bucket || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) return;
  const { bucket, client } = getS3Config();
  await ensureBucketExists(bucket, client);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const { bucket, client } = getS3Config();
  await ensureBucketExists(bucket, client);
  // Só os prefixos públicos (catalog/, branding/): cada upload ganha uma chave
  // única (appendHashSuffix), então o conteúdo daquela URL nunca muda — cache
  // de 1 ano sem revalidação é seguro e faz a foto do cardápio vir do disco,
  // não da rede, nas visitas seguintes. orders/* (comprovante) fica de fora:
  // é privado e não deve ser guardado por cache compartilhado.
  const isPublicAsset = key.startsWith("catalog/") || key.startsWith("branding/");
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
      ...(isPublicAsset ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
    }),
  );
  return { key, url: publicS3Url(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicS3Url(key) };
}

/** Inverte publicS3Url — usado só pra recuperar a key de uma orders.adminAttachmentUrl já salva (única coluna que guarda a URL completa em vez da key) e gerar uma URL assinada nova a cada consulta. */
export function keyFromPublicUrl(url: string): string {
  const base = ENV.s3PublicBaseUrl.replace(/\/+$/, "");
  if (!url.startsWith(`${base}/`)) throw new Error("URL não pertence a este bucket de armazenamento.");
  return url.slice(base.length + 1);
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
