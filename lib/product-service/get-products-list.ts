import { APIGatewayProxyResult, Handler } from "aws-lambda";
import {
  AttributeValue,
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import type { Product, ProductWithStock, Stock } from "./products";

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

const mapProduct = (item: Record<string, AttributeValue>): Product => ({
  id: getStringValue(item.id),
  title: getStringValue(item.title),
  description: getStringValue(item.description),
  price: getNumberValue(item.price),
});

const mapStock = (item: Record<string, AttributeValue>): Stock => ({
  product_id: getStringValue(item.product_id),
  count: getNumberValue(item.count),
});

const scanAllItems = async (
  tableName: string
): Promise<Record<string, AttributeValue>[]> => {
  const items: Record<string, AttributeValue>[] = [];
  let lastEvaluatedKey: Record<string, AttributeValue> | undefined;

  do {
    const response = await dynamoDB.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    items.push(...((response.Items as Record<string, AttributeValue>[]) ?? []));
    lastEvaluatedKey = response.LastEvaluatedKey as
      | Record<string, AttributeValue>
      | undefined;
  } while (lastEvaluatedKey);

  return items;
};

export const getProductsList: Handler =
  async (): Promise<APIGatewayProxyResult> => {
    try {
      const productsTableName = getRequiredEnv("PRODUCTS_TABLE_NAME");
      const stockTableName = getRequiredEnv("STOCK_TABLE_NAME");

      const [productItems, stockItems] = await Promise.all([
        scanAllItems(productsTableName),
        scanAllItems(stockTableName),
      ]);

      const stockByProductId = new Map<string, number>(
        stockItems.map((item) => {
          const stock = mapStock(item);

          return [stock.product_id, stock.count];
        })
      );

      const data: ProductWithStock[] = productItems.map((item) => {
        const product = mapProduct(item);

        return {
          ...product,
          count: stockByProductId.get(product.id) ?? 0,
        };
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data,
          count: data.length,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    } catch (error) {
      console.error("Failed to load products list", error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: "Failed to retrieve products",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }
  };
