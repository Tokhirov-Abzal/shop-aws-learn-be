import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

const DEFAULT_BASIC_AUTH_SECRET_NAME = "basic-auth-credentials";
const VALID_LAMBDA_ENVIRONMENT_KEY = /^[A-Za-z][A-Za-z0-9_]+$/;

const parseDotEnvFile = (fileContent: string): Record<string, string> =>
  fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce<Record<string, string>>((credentials, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return credentials;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (!key || !value) {
        return credentials;
      }

      credentials[key] = value;
      return credentials;
    }, {});

const loadAuthorizerEnvironment = (): Record<string, string> => {
  const envFilePath = path.join(__dirname, "../../.env");

  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  const credentials = parseDotEnvFile(
    fs.readFileSync(envFilePath, { encoding: "utf-8" })
  );

  const lambdaSafeCredentials = Object.fromEntries(
    Object.entries(credentials).filter(([key]) =>
      VALID_LAMBDA_ENVIRONMENT_KEY.test(key)
    )
  );

  return {
    ...lambdaSafeCredentials,
    BASIC_AUTH_CREDENTIALS: JSON.stringify(credentials),
  };
};

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly authorizerLambdaArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthSecretName =
      process.env.BASIC_AUTH_SECRET_NAME ?? DEFAULT_BASIC_AUTH_SECRET_NAME;

    const basicAuthorizerFunction = new nodejs.NodejsFunction(
      this,
      "basicAuthorizer",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(5),
        entry: path.join(__dirname, "basic-authorizer.ts"),
        handler: "main",
        environment: {
          BASIC_AUTH_SECRET_NAME: basicAuthSecretName,
          ...loadAuthorizerEnvironment(),
        },
      }
    );

    basicAuthorizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:${basicAuthSecretName}*`,
        ],
      })
    );

    basicAuthorizerFunction.addPermission("ApiGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceAccount: this.account,
    });

    this.authorizerLambdaArn = basicAuthorizerFunction.functionArn;
  }
}
