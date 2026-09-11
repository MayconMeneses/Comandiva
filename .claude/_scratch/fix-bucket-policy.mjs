import { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.S3_BUCKET;

const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: "*",
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${bucket}/catalog/*`, `arn:aws:s3:::${bucket}/branding/*`],
    },
  ],
};

await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
console.log("POLICY APLICADA");
const check = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
console.log("POLICY CONFIRMADA:", check.Policy);
