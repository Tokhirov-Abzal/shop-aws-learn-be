import { APIGatewayProxyResult, Handler } from "aws-lambda";
import { products } from "./products";

export const getProductsList: Handler =
  async (): Promise<APIGatewayProxyResult> => {
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: products,
        count: products.length,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  };
