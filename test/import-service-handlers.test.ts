const mockS3Send = jest.fn();
const mockSqsSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

jest.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: mockSqsSend,
  })),
  SendMessageCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

import { Readable } from "node:stream";
import { importFileParser } from "../lib/import-service/import-file-parser";

describe("Import Service handlers", () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    mockSqsSend.mockReset();
    process.env.CATALOG_ITEMS_QUEUE_URL =
      "https://sqs.us-east-1.amazonaws.com/123456789012/catalogItemsQueue";
  });

  afterAll(() => {
    delete process.env.CATALOG_ITEMS_QUEUE_URL;
  });

  test("importFileParser sends each CSV record to SQS", async () => {
    mockS3Send.mockResolvedValueOnce({
      Body: Readable.from([
        "title,description,price\n",
        "Product 1,First item,100\n",
        "Product 2,Second item,250\n",
      ]),
    });
    mockSqsSend.mockResolvedValue({});

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await importFileParser(
      {
        Records: [
          {
            s3: {
              bucket: { name: "import-bucket" },
              object: { key: "uploaded/products.csv" },
            },
          },
        ],
      } as any,
      {} as any,
      () => undefined
    );

    expect(mockS3Send).toHaveBeenCalledTimes(1);
    expect(mockSqsSend).toHaveBeenCalledTimes(2);
    expect(mockSqsSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: {
          QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL,
          MessageBody: JSON.stringify({
            title: "Product 1",
            description: "First item",
            price: "100",
          }),
        },
      })
    );
    expect(mockSqsSend).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: {
          QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL,
          MessageBody: JSON.stringify({
            title: "Product 2",
            description: "Second item",
            price: "250",
          }),
        },
      })
    );
    expect(consoleLogSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
