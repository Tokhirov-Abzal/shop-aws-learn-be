import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class HelloS3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "MySecondBucket", {
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
