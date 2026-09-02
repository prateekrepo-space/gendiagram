import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as path from 'path';

export class DgenStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC ──────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'DgenVpc', {
      maxAzs: 2,
      natGateways: 0,  // No NAT GW — EC2 in public subnet, RDS in isolated
      subnetConfiguration: [
        { name: 'public',   subnetType: ec2.SubnetType.PUBLIC,            cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED,  cidrMask: 24 },
      ],
    });

    // ── S3 Bucket ─────────────────────────────────────────────────────────────
    const diagramsBucket = new s3.Bucket(this, 'DiagramsBucket', {
      bucketName: `dgen-diagrams-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        { expiration: cdk.Duration.days(365), id: 'expire-old-diagrams' },
      ],
    });

    // ── RDS Secret ───────────────────────────────────────────────────────────
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'dgen/rds-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dgen_user' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // ── Security Groups ───────────────────────────────────────────────────────
    const albSG = new ec2.SecurityGroup(this, 'AlbSG', {
      vpc, description: 'ALB - allow HTTP from internet',
      allowAllOutbound: true,
    });
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from internet');

    const ecsSG = new ec2.SecurityGroup(this, 'EcsSG', {
      vpc, description: 'ECS Frontend - allow from ALB',
      allowAllOutbound: true,
    });
    ecsSG.addIngressRule(albSG, ec2.Port.tcp(80), 'From ALB');

    const ec2SG = new ec2.SecurityGroup(this, 'BackendSG', {
      vpc, description: 'EC2 Backend - allow port 5000 from ALB',
      allowAllOutbound: true,
    });
    ec2SG.addIngressRule(albSG, ec2.Port.tcp(5000), 'API from ALB');
    // SSM Session Manager needs outbound 443 (already allowed via allowAllOutbound)

    const rdsSG = new ec2.SecurityGroup(this, 'RdsSG', {
      vpc, description: 'RDS - allow from EC2 backend only',
      allowAllOutbound: false,
    });
    rdsSG.addIngressRule(ec2SG, ec2.Port.tcp(5432), 'Postgres from backend');

    // ── RDS PostgreSQL ────────────────────────────────────────────────────────
    const dbInstance = new rds.DatabaseInstance(this, 'DgenDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSG],
      credentials: rds.Credentials.fromSecret(dbSecret),
      databaseName: 'dgen',
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── IAM Role for EC2 (instance profile) ──────────────────────────────────
    const ec2Role = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    // Bedrock — invoke models (Amazon Nova, Claude, etc.)
    ec2Role.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:Converse'],
      resources: ['*'],
    }));
    // S3
    diagramsBucket.grantReadWrite(ec2Role);
    // Secrets Manager — read DB credentials at startup
    dbSecret.grantRead(ec2Role);

    // ── EC2 UserData ──────────────────────────────────────────────────────────
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -euo pipefail',
      '# ── System packages',
      'dnf update -y',
      'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -',
      'dnf install -y nodejs git jq',
      'npm install -g pm2',
      '# ── Clone repo',
      'mkdir -p /app',
      'cd /app',
      'git clone https://github.com/prateekrepo-space/gendiagram . 2>/dev/null || git pull',
      'cd /app/server && npm install --omit=dev',
      '# ── Read DB credentials from Secrets Manager',
      `SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id ${dbSecret.secretArn} --region ap-south-1 --query SecretString --output text)`,
      'DB_USER=$(echo $SECRET_JSON | jq -r .username)',
      'DB_PASSWORD=$(echo $SECRET_JSON | jq -r .password)',
      '# ── Write .env',
      `cat > /app/server/.env <<EOF`,
      `DB_HOST=${dbInstance.dbInstanceEndpointAddress}`,
      `DB_PORT=5432`,
      `DB_NAME=dgen`,
      `DB_USER=$DB_USER`,
      `DB_PASSWORD=$DB_PASSWORD`,
      `S3_BUCKET=${diagramsBucket.bucketName}`,
      `AWS_REGION=ap-south-1`,
      `PORT=5000`,
      `EOF`,
      '# ── Initialise schema',
      'cd /app/server && node init-db.js',
      '# ── Start with PM2',
      'pm2 start server.js --name server --cwd /app/server',
      'pm2 startup systemd -u root --hp /root',
      'pm2 save',
    );

    // ── EC2 Launch Template & Auto Scaling Group ─────────────────────────────
    const launchTemplate = new ec2.LaunchTemplate(this, 'BackendLaunchTemplate', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: ec2SG,
      role: ec2Role,
      userData,
      associatePublicIpAddress: true,
    });

    const asg = new autoscaling.AutoScalingGroup(this, 'BackendASG', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      launchTemplate,
      minCapacity: 1,
      maxCapacity: 1,
    });

    // ── ECS Cluster + Fargate Service (Frontend) ──────────────────────────────
    const cluster = new ecs.Cluster(this, 'DgenCluster', {
      vpc,
      clusterName: 'dgen-cluster',
    });

    // IAM execution role for ECS agent (ECR pull + CloudWatch logs)
    const executionRole = new iam.Role(this, 'FrontendExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // IAM task role for application inside container
    const taskRole = new iam.Role(this, 'FrontendTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const taskDef = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole,
      taskRole,
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
      },
    });

    // Build + push frontend Docker image via CDK asset
    const frontendImage = new ecr_assets.DockerImageAsset(this, 'FrontendImage', {
      directory: path.join(__dirname, '../../client'),
      buildArgs: { VITE_API_URL: '' },
    });

    taskDef.addContainer('FrontendContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(frontendImage),
      portMappings: [{ containerPort: 80 }],
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'dgen-frontend' }),
    });

    const fargateService = new ecs.FargateService(this, 'FrontendService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [ecsSG],
      assignPublicIp: true,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 50,
    });

    // ── ALB ───────────────────────────────────────────────────────────────────
    const alb = new elbv2.ApplicationLoadBalancer(this, 'DgenALB', {
      vpc,
      internetFacing: true,
      securityGroup: albSG,
      loadBalancerName: 'dgen-alb',
    });

    // Target group for ECS frontend (port 80)
    const frontendTG = new elbv2.ApplicationTargetGroup(this, 'FrontendTG', {
      vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });
    fargateService.attachToApplicationTargetGroup(frontendTG);

    // Target group for EC2 backend (port 5000)
    const backendTG = new elbv2.ApplicationTargetGroup(this, 'BackendTG', {
      vpc,
      port: 5000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200',
        interval: cdk.Duration.seconds(15),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });
    asg.attachToApplicationTargetGroup(backendTG);

    // Default listener action -> Frontend
    const listener = alb.addListener('HttpListener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.forward([frontendTG]),
    });

    // Listener rule — /api/* → backend
    listener.addAction('ApiRule', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*'])],
      action: elbv2.ListenerAction.forward([backendTG]),
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AppUrl', {
      value: `http://${alb.loadBalancerDnsName}`,
      description: 'Dgen Application URL (ALB DNS)',
    });
    new cdk.CfnOutput(this, 'S3BucketName', {
      value: diagramsBucket.bucketName,
      description: 'S3 bucket for diagram SVG files',
    });
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: dbInstance.dbInstanceEndpointAddress,
      description: 'RDS PostgreSQL endpoint',
    });

    // ── AWS CodePipeline (CI/CD — fully AWS-native) ───────────────────────────
    // Artifact store
    const artifactBucket = new s3.Bucket(this, 'PipelineArtifacts', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Source artifacts
    const sourceArtifact = new codepipeline.Artifact('Source');
    const buildArtifact  = new codepipeline.Artifact('Build');

    // CodeBuild role — needs CDK deploy permissions
    const buildRole = new iam.Role(this, 'CodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'),
      ],
    });

    // CodeBuild project — runs cdk deploy + updates EC2 backend via SSM
    const buildProject = new codebuild.PipelineProject(this, 'DgenBuild', {
      projectName: 'dgen-cdk-deploy',
      role: buildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,   // needed for Docker (building frontend image)
        computeType: codebuild.ComputeType.SMALL,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yml'),
      environmentVariables: {
        AWS_REGION: { value: 'ap-south-1' },
      },
      timeout: cdk.Duration.minutes(30),
    });

    // CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'DgenPipeline', {
      pipelineName: 'dgen-deploy-pipeline',
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub_Source',
              owner: 'prateekrepo-space',
              repo: 'gendiagram',
              branch: 'main',
              connectionArn: 'arn:aws:codeconnections:ap-south-1:187004426499:connection/b6ecc572-bb6f-4b20-bc99-7881c8615754',
              output: sourceArtifact,
            }),
          ],
        },
        {
          stageName: 'Deploy',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'CDK_Deploy',
              project: buildProject,
              input: sourceArtifact,
              outputs: [buildArtifact],
            }),
          ],
        },
      ],
    });

    new cdk.CfnOutput(this, 'PipelineUrl', {
      value: `https://ap-south-1.console.aws.amazon.com/codesuite/codepipeline/pipelines/dgen-deploy-pipeline/view`,
      description: 'AWS CodePipeline URL',
    });
  }
}
