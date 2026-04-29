import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import { products } from "./products";

export const getProductsById: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.productId;
  const product = products.find((p) => String(p.id) === String(productId));

  if (product) {
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
  }

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
};
