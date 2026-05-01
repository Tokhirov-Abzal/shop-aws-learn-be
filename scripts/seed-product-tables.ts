import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput,
  DynamoDBClient,
  WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { products, stocks } from "../lib/product-service/products";

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const productsTableName = process.env.PRODUCTS_TABLE_NAME ?? "products";
const stockTableName = process.env.STOCK_TABLE_NAME ?? "stock";

if (!region) {
  throw new Error(
    "Set AWS_REGION or AWS_DEFAULT_REGION before seeding DynamoDB tables."
  );
}

const dynamoDB = new DynamoDBClient({ region });

const chunk = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
};

const writeRequests = {
  [productsTableName]: products.map<WriteRequest>((product) => ({
    PutRequest: {
      Item: {
        id: { S: product.id },
        title: { S: product.title },
        description: { S: product.description },
        price: { N: String(product.price) },
      },
    },
  })),
  [stockTableName]: stocks.map<WriteRequest>((stock) => ({
    PutRequest: {
      Item: {
        product_id: { S: stock.product_id },
        count: { N: String(stock.count) },
      },
    },
  })),
};

const batchWriteWithRetry = async (
  tableName: string,
  requests: WriteRequest[]
): Promise<void> => {
  for (const requestChunk of chunk(requests, 25)) {
    let pending: BatchWriteItemCommandInput["RequestItems"] = {
      [tableName]: requestChunk,
    };

    while (pending && Object.keys(pending).length > 0) {
      const response: BatchWriteItemCommandOutput = await dynamoDB.send(
        new BatchWriteItemCommand({
          RequestItems: pending,
        })
      );

      pending = response.UnprocessedItems;
    }
  }
};

const seed = async (): Promise<void> => {
  await batchWriteWithRetry(
    productsTableName,
    writeRequests[productsTableName]
  );
  console.log(`Seeded ${products.length} items into ${productsTableName}.`);

  await batchWriteWithRetry(stockTableName, writeRequests[stockTableName]);
  console.log(`Seeded ${stocks.length} items into ${stockTableName}.`);
};

seed().catch((error: unknown) => {
  console.error("Failed to seed DynamoDB tables.", error);
  process.exitCode = 1;
});
