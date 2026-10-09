import { CreateBucketCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { storageGetSignedUrl, storagePut } from "../server/storage.ts";

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;
const client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
} catch (error) {
  if (!String(error?.name || error).includes("BucketAlreadyOwnedByYou")) throw error;
}

const payload = Buffer.from("Comandiva independent S3 smoke test", "utf8");
const stored = await storagePut("smoke/independent-storage.txt", payload, "text/plain");
if (!stored.url.startsWith(process.env.S3_PUBLIC_BASE_URL)) throw new Error(`Unexpected public URL: ${stored.url}`);

const signedUrl = await storageGetSignedUrl(stored.key);
const response = await fetch(signedUrl);
if (!response.ok) throw new Error(`Signed GET failed: ${response.status}`);
const downloaded = Buffer.from(await response.arrayBuffer());
if (!downloaded.equals(payload)) throw new Error("Downloaded object differs from uploaded payload");

const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: stored.key }));
if (!object.Body) throw new Error("MinIO returned an empty object body");
console.log(`S3/MinIO upload aprovado: ${stored.key}; signed GET=${response.status}; bytes=${downloaded.length}`);
