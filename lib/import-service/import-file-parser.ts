import { Readable } from "node:stream";
import type { S3Event, S3Handler } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import csvParser from "csv-parser";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const getReadableBody = (body: unknown): Readable => {
  if (body instanceof Readable) {
    return body;
  }

  throw new Error("S3 object body is not a readable stream");
};

const getCatalogItemsQueueUrl = (): string => {
  const queueUrl = process.env.CATALOG_ITEMS_QUEUE_URL;

  if (!queueUrl) {
    throw new Error(
      "Missing required environment variable: CATALOG_ITEMS_QUEUE_URL"
    );
  }

  return queueUrl;
};

const parseCsvObject = async (bucketName: string, objectKey: string) => {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  );

  const bodyStream = getReadableBody(response.Body);
  const queueUrl = getCatalogItemsQueueUrl();

  await new Promise<void>((resolve, reject) => {
    const sendTasks: Promise<unknown>[] = [];

    bodyStream
      .pipe(csvParser())
      .on("data", (record) => {
        sendTasks.push(
          sqsClient.send(
            new SendMessageCommand({
              QueueUrl: queueUrl,
              MessageBody: JSON.stringify(record),
            })
          )
        );
      })
      .on("end", () => {
        Promise.all(sendTasks).then(() => resolve()).catch(reject);
      })
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
