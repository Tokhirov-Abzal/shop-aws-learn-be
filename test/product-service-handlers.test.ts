import { getProductsList } from "../lib/product-service/get-products-list";
import { getProductsById } from "../lib/product-service/get-products-by-id";
import { products } from "../lib/product-service/products";

describe("Product Service handlers", () => {
  test("getProductsList returns full products array", async () => {
    const result = await getProductsList({}, {} as any, () => undefined);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(products);
    expect(body.count).toBe(products.length);
  });

  test("getProductsById returns product for valid id", async () => {
    const event = {
      pathParameters: {
        productId: products[0].id,
      },
    };

    const result = await getProductsById(
      event as any,
      {} as any,
      () => undefined
    );

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(products[0]);
  });

  test("getProductsById returns 404 for invalid id", async () => {
    const event = {
      pathParameters: {
        productId: "unknown",
      },
    };

    const result = await getProductsById(
      event as any,
      {} as any,
      () => undefined
    );

    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Product not found");
  });
});
