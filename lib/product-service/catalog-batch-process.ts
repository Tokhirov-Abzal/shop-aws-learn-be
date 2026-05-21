import { SQSBatchResponse, SQSHandler, SQSRecord } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { createProductRecord, CreateProductRequest } from "./create-product";

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

const parseRecordBody = (record: SQSRecord): CreateProductRequest => {
  const parsedBody = JSON.parse(record.body) as CreateProductRequest;

  if (!parsedBody || typeof parsedBody !== "object") {
    throw new Error("SQS message body must be a JSON object");
  }

  return parsedBody;
};

const getCreateProductTopicArn = (): string => {
  const topicArn = process.env.CREATE_PRODUCT_TOPIC_ARN;

  if (!topicArn) {
    throw new Error(
      "Missing required environment variable: CREATE_PRODUCT_TOPIC_ARN"
    );
  }

  return topicArn;
};

export const catalogBatchProcess: SQSHandler = async (
  event
): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  const createdProducts = [];

  for (const record of event.Records) {
    try {
      const payload = parseRecordBody(record);

      const product = await createProductRecord(payload);
      createdProducts.push(product);
    } catch (error) {
      console.error("Failed to process catalog item", {
        messageId: record.messageId,
        error,
      });

      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  if (createdProducts.length > 0) {
    await snsClient.send(
      new PublishCommand({
        TopicArn: getCreateProductTopicArn(),
        Subject: "Products created",
        Message: JSON.stringify({
          count: createdProducts.length,
          products: createdProducts,
        }),
      })
    );
  }

  return { batchItemFailures };
};
