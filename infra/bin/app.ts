#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DgenStack } from '../lib/dgen-stack';

const app = new cdk.App();

new DgenStack(app, 'DgenStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'ap-south-1',
  },
  description: 'Dgen — AI Diagram Maker (ECS + EC2 + RDS + Bedrock)',
});