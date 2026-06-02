const mockSecretsManagerSend = jest.fn();

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: mockSecretsManagerSend,
  })),
  GetSecretValueCommand: jest.fn().mockImplementation((input: unknown) => ({
    input,
  })),
}));

import { main } from "../lib/authorization-service/basic-authorizer";

describe("Authorization Service handlers", () => {
  const methodArn =
    "arn:aws:execute-api:us-east-1:123456789012:api-id/dev/GET/import";
  const login = "Tokhirov-Abzal";

  beforeEach(() => {
    mockSecretsManagerSend.mockReset();
    mockSecretsManagerSend.mockResolvedValue({
      SecretString: JSON.stringify({
        username: login,
        password: "TEST_PASSWORD",
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.BASIC_AUTH_CREDENTIALS;
  });

  test("returns 401 when Authorization header is missing", async () => {
    await expect(
      main(
        {
          type: "TOKEN",
          methodArn,
        } as any,
        {} as any,
        () => undefined
      )
    ).rejects.toThrow("Unauthorized");
  });

  test("returns a deny policy for invalid credentials", async () => {
    const response = await main(
      {
        type: "TOKEN",
        methodArn,
        authorizationToken: `Basic ${Buffer.from(
          `${login}:WRONG_PASSWORD`
        ).toString("base64")}`,
      } as any,
      {} as any,
      () => undefined
    );

    expect(response).toEqual(
      expect.objectContaining({
        principalId: login,
        policyDocument: expect.objectContaining({
          Statement: [
            expect.objectContaining({
              Effect: "Deny",
              Resource: methodArn,
            }),
          ],
        }),
      })
    );
  });

  test("returns an allow policy for valid credentials", async () => {
    const response = await main(
      {
        type: "TOKEN",
        methodArn,
        authorizationToken: `Basic ${Buffer.from(
          `${login}:TEST_PASSWORD`
        ).toString("base64")}`,
      } as any,
      {} as any,
      () => undefined
    );

    expect(response).toEqual(
      expect.objectContaining({
        principalId: login,
        policyDocument: expect.objectContaining({
          Statement: [
            expect.objectContaining({
              Effect: "Allow",
              Resource: methodArn,
            }),
          ],
        }),
      })
    );
  });
});
