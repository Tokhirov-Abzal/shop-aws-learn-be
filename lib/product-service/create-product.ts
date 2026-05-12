import { randomUUID } from "node:crypto";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

type CreateProductRequest = {
  title?: string;
  description?: string;
  price?: number;
};

const parseCreateProductPayload = (
  event: APIGatewayProxyEvent
): CreateProductRequest | null => {
  if (typeof event.body === "string" && event.body.trim()) {
    return JSON.parse(event.body) as CreateProductRequest;
  }

  if (event.body && typeof event.body === "object") {
    return event.body as unknown as CreateProductRequest;
  }

  const directPayload = event as unknown as CreateProductRequest;

  if (
    directPayload.title !== undefined ||
    directPayload.description !== undefined ||
    directPayload.price !== undefined
  ) {
    return directPayload;
  }

  return null;
};

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });

const getProductsTableName = (): string => {
  const tableName = process.env.PRODUCTS_TABLE_NAME;

  if (!tableName) {
    throw new Error(
      "Missing required environment variable: PRODUCTS_TABLE_NAME"
    );
  }

  return tableName;
};

const badRequest = (message: string): APIGatewayProxyResult => ({
  statusCode: 400,
  body: JSON.stringify({
    success: false,
    message,
  }),
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
});

export const createProduct: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const payload = parseCreateProductPayload(event);

    if (!payload) {
      return badRequest("Request body is required");
    }

    const title = payload.title?.trim();
    const description = payload.description?.trim() ?? "";
    const price = payload.price;

    if (!title) {
      return badRequest("Title is required");
    }

    if (!Number.isInteger(price)) {
      return badRequest("Price must be an integer");
    }

    const product = {
      id: randomUUID(),
      title,
      description,
      price,
    };

    await dynamoDB.send(
      new PutItemCommand({
        TableName: getProductsTableName(),
        Item: {
          id: { S: product.id },
          title: { S: product.title },
          description: { S: product.description },
          price: { N: String(product.price) },
        },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        data: product,
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  } catch (error) {
    console.error("Failed to create product", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Failed to create product",
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
};
