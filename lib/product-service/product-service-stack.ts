import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as path from "path";
import { Construct } from "constructs";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsListFunction = new lambda.Function(
      this,
      "getProductsList",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 512,
        timeout: cdk.Duration.seconds(5),
        handler: "get-products-list.getProductsList",
        code: lambda.Code.fromAsset(path.join(__dirname, "./")),
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
      }
    );

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
      allowMethods: ["GET"],
      allowHeaders: ["Content-Type"],
    });

    productByIdResource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ["GET"],
      allowHeaders: ["Content-Type"],
    });
  }
}
