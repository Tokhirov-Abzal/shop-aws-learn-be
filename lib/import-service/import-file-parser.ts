import { Readable } from "node:stream";
import type { S3Event, S3Handler } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import csvParser from "csv-parser";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

const getReadableBody = (body: unknown): Readable => {
  if (body instanceof Readable) {
    return body;
  }

  throw new Error("S3 object body is not a readable stream");
};

const parseCsvObject = async (bucketName: string, objectKey: string) => {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  );

  const bodyStream = getReadableBody(response.Body);

  await new Promise<void>((resolve, reject) => {
    bodyStream
      .pipe(csvParser())
      .on("data", (record) => {
        console.log("Parsed CSV record", record);
      })
      .on("end", resolve)
      .on("error", reject);
  });
};

export const importFileParser: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " ")
    );

    if (!objectKey.startsWith("uploaded/") || !objectKey.endsWith(".csv")) {
      console.log(`Skipping unsupported object: ${objectKey}`);
      continue;
    }

    await parseCsvObject(bucketName, objectKey);
  }
};
