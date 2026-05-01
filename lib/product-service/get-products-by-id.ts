import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { ProductWithStock } from "./products";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });

const getRequiredEnv = (name: "PRODUCTS_TABLE_NAME" | "STOCK_TABLE_NAME") => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getStringValue = (attribute?: AttributeValue): string => {
  if (attribute && "S" in attribute && attribute.S) {
    return attribute.S;
  }

  return "";
};

const getNumberValue = (attribute?: AttributeValue): number => {
  if (attribute && "N" in attribute && attribute.N) {
    return Number(attribute.N);
  }

  return 0;
};

export const getProductsById: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: "Product not found",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    const productsTableName = getRequiredEnv("PRODUCTS_TABLE_NAME");
    const stockTableName = getRequiredEnv("STOCK_TABLE_NAME");

    const [productResponse, stockResponse] = await Promise.all([
      dynamoDB.send(
        new GetItemCommand({
          TableName: productsTableName,
          Key: {
            id: { S: productId },
          },
        })
      ),
      dynamoDB.send(
        new GetItemCommand({
          TableName: stockTableName,
          Key: {
            product_id: { S: productId },
          },
        })
      ),
    ]);

    if (!productResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          message: "Product not found",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    const product: ProductWithStock = {
      id: getStringValue(productResponse.Item.id),
      title: getStringValue(productResponse.Item.title),
      description: getStringValue(productResponse.Item.description),
      price: getNumberValue(productResponse.Item.price),
      count: stockResponse.Item ? getNumberValue(stockResponse.Item.count) : 0,
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: product,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Failed to load product by id", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Failed to retrieve product",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
