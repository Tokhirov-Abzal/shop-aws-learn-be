import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as path from "path";
import { Construct } from "constructs";

export class ProductServiceStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: "products",
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const stockTable = new dynamodb.Table(this, "StockTable", {
      tableName: "stock",
      partitionKey: {
        name: "product_id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const createProductTopic = new sns.Topic(this, "createProductTopic", {
      topicName: "createProductTopic",
    });

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("abzal8187@gmail.com")
    );

    const getProductsListFunction = new lambda.Function(
      this,
      "getProductsList",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(5),
        handler: "get-products-list.getProductsList",
        code: lambda.Code.fromAsset(path.join(__dirname, "./")),
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
          STOCK_TABLE_NAME: stockTable.tableName,
        },
      }
    );

    const getProductsByIdFunction = new lambda.Function(
      this,
      "getProductsById",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(5),
        handler: "get-products-by-id.getProductsById",
        code: lambda.Code.fromAsset(path.join(__dirname, "./")),
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
          STOCK_TABLE_NAME: stockTable.tableName,
        },
      }
    );

    const createProductFunction = new lambda.Function(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(5),
      handler: "create-product.createProduct",
      code: lambda.Code.fromAsset(path.join(__dirname, "./")),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
      },
    });

    this.catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue", {
      queueName: "catalogItemsQueue",
    });

    const catalogBatchProcessFunction = new lambda.Function(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(5),
        handler: "catalog-batch-process.catalogBatchProcess",
        code: lambda.Code.fromAsset(path.join(__dirname, "./")),
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
          CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
        },
      }
    );

    catalogBatchProcessFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.catalogItemsQueue, {
        batchSize: 5,
      })
    );

    productsTable.grantReadData(getProductsListFunction);
    productsTable.grantReadData(getProductsByIdFunction);
    productsTable.grantWriteData(createProductFunction);
    productsTable.grantWriteData(catalogBatchProcessFunction);
    createProductTopic.grantPublish(catalogBatchProcessFunction);
    stockTable.grantReadData(getProductsListFunction);
    stockTable.grantReadData(getProductsByIdFunction);

    new cdk.CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
    });

    new cdk.CfnOutput(this, "StockTableName", {
      value: stockTable.tableName,
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: this.catalogItemsQueue.queueUrl,
    });

    new cdk.CfnOutput(this, "CreateProductTopicArn", {
      value: createProductTopic.topicArn,
    });

    const api = new apigateway.RestApi(this, "products-api", {
      restApiName: "Products API",
      description: "This API serves product information.",
    });

    const getProductsIntegration = new apigateway.LambdaIntegration(
      getProductsListFunction,
      {
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type'",
              "method.response.header.Access-Control-Allow-Methods":
                "'GET,OPTIONS'",
            },
            responseTemplates: {
              "application/json": "$input.json('$')",
            },
          },
        ],
        proxy: false,
      }
    );

    const getProductByIdIntegration = new apigateway.LambdaIntegration(
      getProductsByIdFunction,
      {
        requestTemplates: {
          "application/json": `{
            "pathParameters": {
              "productId": "$input.params('productId')"
            }
          }`,
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type'",
              "method.response.header.Access-Control-Allow-Methods":
                "'GET,OPTIONS'",
            },
            responseTemplates: {
              "application/json": "$input.json('$')",
            },
          },
          {
            statusCode: "404",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
              "method.response.header.Access-Control-Allow-Headers":
                "'Content-Type'",
              "method.response.header.Access-Control-Allow-Methods":
                "'GET,OPTIONS'",
            },
            responseTemplates: {
              "application/json": "$input.json('$')",
            },
          },
        ],
        proxy: false,
      }
    );

    const createProductIntegration = new apigateway.LambdaIntegration(
      createProductFunction
    );

    // Create a resource /products and GET request under it
    const productsResource = api.root.addResource("products");
    // On this resource attach a GET method which passes request to our Lambda function
    productsResource.addMethod("GET", getProductsIntegration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
      ],
    });
    productsResource.addMethod("POST", createProductIntegration, {
      methodResponses: [
        {
          statusCode: "201",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
        {
          statusCode: "400",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
        {
          statusCode: "500",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
      ],
    });
    // Create a resource /products/{productId} and GET request under it
    const productByIdResource = productsResource.addResource("{productId}");
    // On this resource attach a GET method which passes request to our Lambda function
    productByIdResource.addMethod("GET", getProductByIdIntegration, {
      requestParameters: {
        "method.request.path.productId": true,
      },
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
        {
          statusCode: "404",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
          },
        },
      ],
    });

    // Add CORS preflight
    productsResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ["GET", "POST"],
      allowHeaders: ["Content-Type"],
    });

    productByIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ["GET"],
      allowHeaders: ["Content-Type"],
    });
  }
}
