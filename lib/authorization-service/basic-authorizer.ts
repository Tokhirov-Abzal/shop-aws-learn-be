import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerHandler,
  StatementEffect,
} from "aws-lambda";

const UNAUTHORIZED_ERROR_MESSAGE = "Unauthorized";
const BASIC_PREFIX = "Basic ";
const DEFAULT_BASIC_AUTH_SECRET_NAME = "basic-auth-credentials";

const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION,
});

const getFallbackCredentials = (): Record<string, string> => {
  const serializedCredentials = process.env.BASIC_AUTH_CREDENTIALS;

  if (!serializedCredentials) {
    return {};
  }

  try {
    return JSON.parse(serializedCredentials) as Record<string, string>;
  } catch (error) {
    console.error("Failed to parse BASIC_AUTH_CREDENTIALS", error);
    return {};
  }
};

const normalizeCredentials = (
  secretString: string | undefined
): Record<string, string> => {
  if (!secretString) {
    return {};
  }

  try {
    const parsedCredentials = JSON.parse(secretString) as
      | Record<string, string>
      | { username?: string; password?: string };

    if (
      "username" in parsedCredentials &&
      "password" in parsedCredentials &&
      parsedCredentials.username &&
      parsedCredentials.password
    ) {
      return {
        [parsedCredentials.username]: parsedCredentials.password,
      };
    }

    return parsedCredentials as Record<string, string>;
  } catch (error) {
    console.error("Failed to parse basic auth secret", error);
    return {};
  }
};

const getCredentials = async (): Promise<Record<string, string>> => {
  const secretId =
    process.env.BASIC_AUTH_SECRET_NAME ?? DEFAULT_BASIC_AUTH_SECRET_NAME;

  try {
    const secret = await secretsManagerClient.send(
      new GetSecretValueCommand({
        SecretId: secretId,
      })
    );

    const credentials = normalizeCredentials(secret.SecretString);

    if (Object.keys(credentials).length > 0) {
      return credentials;
    }
  } catch (error) {
    console.error(
      "Failed to load basic auth credentials from Secrets Manager",
      error
    );
  }

  return getFallbackCredentials();
};

const generatePolicy = (
  principalId: string,
  effect: StatementEffect,
  resource: string
): APIGatewayAuthorizerResult => ({
  principalId,
  policyDocument: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "execute-api:Invoke",
        Effect: effect,
        Resource: resource,
      },
    ],
  },
});

const verifyCredentials = async (
  authorizationToken: string | undefined
): Promise<{ authorized: boolean; login: string }> => {
  if (!authorizationToken) {
    throw new Error(UNAUTHORIZED_ERROR_MESSAGE);
  }

  if (!authorizationToken.startsWith(BASIC_PREFIX)) {
    return {
      authorized: false,
      login: "anonymous",
    };
  }

  const encodedCredentials = authorizationToken.slice(BASIC_PREFIX.length);
  const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString(
    "utf-8"
  );
  const [login, password] = decodedCredentials.split(":");

  if (!login || !password) {
    return {
      authorized: false,
      login: "anonymous",
    };
  }

  const credentials = await getCredentials();
  const expectedPassword = credentials[login] ?? process.env[login];

  return {
    authorized: Boolean(expectedPassword) && expectedPassword === password,
    login,
  };
};

export const main: APIGatewayTokenAuthorizerHandler = async (event) => {
  const authorizationToken = event.authorizationToken;

  console.log(
    "[Basic Authorizer]: Received request with Authorization header:",
    authorizationToken ? `${authorizationToken.substring(0, 20)}...` : "missing"
  );

  const { authorized, login } = await verifyCredentials(authorizationToken);

  console.log("[Basic Authorizer]: Authorization result:", authorized);

  return generatePolicy(login, authorized ? "Allow" : "Deny", event.methodArn);
};

export const basicAuthorizer: APIGatewayTokenAuthorizerHandler = main;
