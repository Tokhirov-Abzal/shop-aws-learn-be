import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "path";
import { Construct } from "constructs";

type ImportServiceStackProps = cdk.StackProps & {
  catalogItemsQueue: sqs.IQueue;
};

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const importBucket = new s3.Bucket(this, "ImportBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
        },
      ],
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new s3deploy.BucketDeployment(this, "UploadedFolder", {
      destinationBucket: importBucket,
      prune: false,
      retainOnDelete: false,
      sources: [s3deploy.Source.data("uploaded/.keep", "")],
    });

    const importProductsFileFunction = new nodejs.NodejsFunction(
      this,
      "importProductsFile",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(5),
        entry: path.join(__dirname, "import-products-file.ts"),
        handler: "importProductsFile",
        environment: {
          IMPORT_BUCKET_NAME: importBucket.bucketName,
        },
      }
    );

    const importFileParserFunction = new nodejs.NodejsFunction(
      this,
      "importFileParser",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(10),
        entry: path.join(__dirname, "import-file-parser.ts"),
        handler: "importFileParser",
        environment: {
          IMPORT_BUCKET_NAME: importBucket.bucketName,
          CATALOG_ITEMS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
        },
      }
    );

    importProductsFileFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [importBucket.arnForObjects("uploaded/*")],
      })
    );

    props.catalogItemsQueue.grantSendMessages(importFileParserFunction);

    importBucket.grantRead(importFileParserFunction, "uploaded/*");
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserFunction),
      {
        prefix: "uploaded/",
      }
    );

    const api = new apigateway.RestApi(this, "import-service-api", {
      restApiName: "Import Service API",
      description: "This API serves import service endpoints.",
    });

    const importProductsFileIntegration = new apigateway.LambdaIntegration(
      importProductsFileFunction
    );

    const importResource = api.root.addResource("import");
    importResource.addMethod("GET", importProductsFileIntegration);

    importResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ["GET"],
      allowHeaders: ["Content-Type"],
    });

    new cdk.CfnOutput(this, "ImportBucketName", {
      value: importBucket.bucketName,
    });

    new cdk.CfnOutput(this, "ImportServiceApiUrl", {
      value: `${api.url}import`,
    });
  }
}
