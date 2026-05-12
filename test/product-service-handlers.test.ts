const mockSend = jest.fn();

jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "7a9c2f31-7cf9-4df5-8d23-0fdd0f21e001"),
}));

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetItemCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
  PutItemCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
  ScanCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

import { createProduct } from "../lib/product-service/create-product";
import { getProductsList } from "../lib/product-service/get-products-list";
import { getProductsById } from "../lib/product-service/get-products-by-id";
import { products, stocks } from "../lib/product-service/products";

describe("Product Service handlers", () => {
  beforeEach(() => {
    mockSend.mockReset();
    process.env.PRODUCTS_TABLE_NAME = "products";
    process.env.STOCK_TABLE_NAME = "stock";
  });

  afterAll(() => {
    delete process.env.PRODUCTS_TABLE_NAME;
    delete process.env.STOCK_TABLE_NAME;
  });

  test("getProductsList returns joined products and stock data", async () => {
    mockSend
      .mockResolvedValueOnce({
        Items: products.map((product) => ({
          id: { S: product.id },
          title: { S: product.title },
          description: { S: product.description },
          price: { N: String(product.price) },
        })),
      })
      .mockResolvedValueOnce({
        Items: stocks.map((stock) => ({
          product_id: { S: stock.product_id },
          count: { N: String(stock.count) },
        })),
      });

    const result = await getProductsList({}, {} as any, () => undefined);
    const expectedProducts = products.map((product) => ({
      ...product,
      count:
        stocks.find((stock) => stock.product_id === product.id)?.count ?? 0,
    }));

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(expectedProducts);
    expect(body.count).toBe(expectedProducts.length);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "products",
        }),
      })
    );
    expect(mockSend).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "stock",
        }),
      })
    );
  });

  test("getProductsById returns product for valid id", async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: {
          id: { S: products[0].id },
          title: { S: products[0].title },
          description: { S: products[0].description },
          price: { N: String(products[0].price) },
        },
      })
      .mockResolvedValueOnce({
        Item: {
          product_id: { S: stocks[0].product_id },
          count: { N: String(stocks[0].count) },
        },
      });

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
    expect(body.data).toEqual({
      ...products[0],
      count: stocks[0].count,
    });
    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "products",
          Key: {
            id: { S: products[0].id },
          },
        }),
      })
    );
    expect(mockSend).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: "stock",
          Key: {
            product_id: { S: products[0].id },
          },
        }),
      })
    );
  });

  test("getProductsById returns 404 for invalid id", async () => {
    mockSend.mockResolvedValueOnce({
      Item: undefined,
    });

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
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  test("createProduct stores a new product in the products table", async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await createProduct(
      {
        body: JSON.stringify({
          title: "New Product",
          description: "Created from test",
          price: 199,
        }),
      } as any,
      {} as any,
      () => undefined
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "7a9c2f31-7cf9-4df5-8d23-0fdd0f21e001",
      title: "New Product",
      description: "Created from test",
      price: 199,
    });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TableName: "products",
          Item: {
            id: { S: "7a9c2f31-7cf9-4df5-8d23-0fdd0f21e001" },
            title: { S: "New Product" },
            description: { S: "Created from test" },
            price: { N: "199" },
          },
        },
      })
    );
  });

  test("createProduct accepts a direct payload without event.body", async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await createProduct(
      {
        title: "Direct Product",
        description: "Invoked directly",
        price: 249,
      } as any,
      {} as any,
      () => undefined
    );

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "7a9c2f31-7cf9-4df5-8d23-0fdd0f21e001",
      title: "Direct Product",
      description: "Invoked directly",
      price: 249,
    });
  });

  test("createProduct returns 400 when title is missing", async () => {
    const result = await createProduct(
      {
        body: JSON.stringify({
          description: "Created from test",
          price: 199,
        }),
      } as any,
      {} as any,
      () => undefined
    );

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(false);
    expect(body.message).toBe("Title is required");
    expect(mockSend).not.toHaveBeenCalled();
  });
});
