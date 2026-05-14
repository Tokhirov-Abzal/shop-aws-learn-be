import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const SIGNED_URL_TTL_SECONDS = 300;

const jsonResponse = (
  statusCode: number,
  body: string | Record<string, unknown>
): APIGatewayProxyResult => ({
  statusCode,
  body: typeof body === "string" ? body : JSON.stringify(body),
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type":
      typeof body === "string" ? "text/plain" : "application/json",
  },
});

const getImportBucketName = (): string => {
  const bucketName = process.env.IMPORT_BUCKET_NAME;

  if (!bucketName) {
    throw new Error(
      "Missing required environment variable: IMPORT_BUCKET_NAME"
    );
  }

  return bucketName;
};

const getFileName = (event: APIGatewayProxyEvent): string | null => {
  const fileName = event.queryStringParameters?.fileName?.trim();

  if (!fileName) {
    return null;
  }

  return fileName;
};

export const importProductsFile: Handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const fileName = getFileName(event);

    if (!fileName) {
      return jsonResponse(400, {
        message: "Query parameter 'fileName' is required",
      });
    }

    const signedUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: getImportBucketName(),
        Key: `uploaded/${fileName}`,
        ContentType: "text/csv",
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );

    return jsonResponse(200, signedUrl);
  } catch (error) {
    console.error("Failed to create signed URL", error);

    return jsonResponse(500, { message: "Failed to create signed URL" });
  }
};
