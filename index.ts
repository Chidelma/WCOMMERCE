import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

const projectName = "wcommerce";
const applicationPort = 5000;
const httpPort = 80;
const apiHealthPath = "/WeatherForecast";

const tags = {
    Name: projectName,
    Project: "WCOMMERCE",
};

const vpc = new awsx.ec2.Vpc(`${projectName}-vpc`, {
    cidrBlock: "10.0.0.0/16",
    instanceTenancy: "default",
    tags,
});

const frontendSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-frontend-sg`, {
    vpcId: vpc.vpcId,
    description: "Security boundary for the public storefront load balancer and private web tasks.",
    ingress: [
        {
            description: "Allow public HTTP traffic to the storefront load balancer.",
            fromPort: httpPort,
            toPort: httpPort,
            protocol: "tcp",
            cidrBlocks: ["0.0.0.0/0"],
        },
        {
            description: "Allow the storefront load balancer to reach the web tasks.",
            fromPort: applicationPort,
            toPort: applicationPort,
            protocol: "tcp",
            self: true,
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
    tags: {
        ...tags,
        Role: "frontend",
    },
});

const backendSecurityGroup = new aws.ec2.SecurityGroup(`${projectName}-backend-sg`, {
    vpcId: vpc.vpcId,
    description: "Security boundary for the internal API load balancer and private API tasks.",
    ingress: [
        {
            description: "Allow web tasks to call the internal API load balancer.",
            fromPort: httpPort,
            toPort: httpPort,
            protocol: "tcp",
            securityGroups: [frontendSecurityGroup.id],
        },
        {
            description: "Allow the internal API load balancer to reach the API tasks.",
            fromPort: applicationPort,
            toPort: applicationPort,
            protocol: "tcp",
            self: true,
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
        },
    ],
    tags: {
        ...tags,
        Role: "backend",
    },
});

const frontendRepository = new awsx.ecr.Repository(`${projectName}-web`, { tags });
const backendRepository = new awsx.ecr.Repository(`${projectName}-api`, { tags });

const frontendImage = new awsx.ecr.Image(`${projectName}-web`, {
    repositoryUrl: frontendRepository.url,
    path: "./infra-web",
});

const backendImage = new awsx.ecr.Image(`${projectName}-api`, {
    repositoryUrl: backendRepository.url,
    path: "./infra-api",
});

const cluster = new aws.ecs.Cluster(`${projectName}-cluster`, { tags });

const frontendLoadBalancer = new awsx.lb.ApplicationLoadBalancer(`${projectName}-web-lb`, {
    tags,
    subnetIds: vpc.publicSubnetIds,
    securityGroups: [frontendSecurityGroup.id],
    defaultTargetGroup: {
        port: applicationPort,
        protocol: "HTTP",
        targetType: "ip",
        healthCheck: {
            path: "/",
        },
    },
});

const backendLoadBalancer = new awsx.lb.ApplicationLoadBalancer(`${projectName}-api-lb`, {
    tags,
    internal: true,
    subnetIds: vpc.privateSubnetIds,
    securityGroups: [backendSecurityGroup.id],
    defaultTargetGroup: {
        port: applicationPort,
        protocol: "HTTP",
        targetType: "ip",
        healthCheck: {
            path: apiHealthPath,
        },
    },
});

const frontendTaskDefinition = new awsx.ecs.FargateTaskDefinition(`${projectName}-web-td`, {
    tags,
    containers: {
        infraweb: {
            image: frontendImage.imageUri,
            name: "woo-web",
            cpu: 512,
            memory: 128,
            environment: [
                {
                    name: "ApiAddress",
                    value: pulumi.interpolate`http://${backendLoadBalancer.loadBalancer.dnsName}${apiHealthPath}`,
                },
            ],
            portMappings: [
                {
                    containerPort: applicationPort,
                    hostPort: applicationPort,
                },
            ],
        },
    },
});

const backendTaskDefinition = new awsx.ecs.FargateTaskDefinition(`${projectName}-api-td`, {
    tags,
    containers: {
        infraapi: {
            image: backendImage.imageUri,
            name: "woo-api",
            cpu: 512,
            memory: 128,
            portMappings: [
                {
                    containerPort: applicationPort,
                    hostPort: applicationPort,
                },
            ],
        },
    },
});

const frontendService = new awsx.ecs.FargateService(`${projectName}-web-srv`, {
    cluster: cluster.arn,
    desiredCount: 2,
    taskDefinition: frontendTaskDefinition.taskDefinition.arn,
    tags,
    networkConfiguration: {
        assignPublicIp: false,
        subnets: vpc.privateSubnetIds,
        securityGroups: [frontendSecurityGroup.id],
    },
    loadBalancers: [
        {
            targetGroupArn: frontendLoadBalancer.defaultTargetGroup.arn,
            containerName: "infraweb",
            containerPort: applicationPort,
        },
    ],
});

const backendService = new awsx.ecs.FargateService(`${projectName}-api-srv`, {
    cluster: cluster.arn,
    desiredCount: 2,
    taskDefinition: backendTaskDefinition.taskDefinition.arn,
    tags,
    networkConfiguration: {
        assignPublicIp: false,
        subnets: vpc.privateSubnetIds,
        securityGroups: [backendSecurityGroup.id],
    },
    loadBalancers: [
        {
            targetGroupArn: backendLoadBalancer.defaultTargetGroup.arn,
            containerName: "infraapi",
            containerPort: applicationPort,
        },
    ],
});

const webAcl = new aws.wafv2.WebAcl(`${projectName}-acl`, {
    scope: "REGIONAL",
    defaultAction: {
        allow: {},
    },
    visibilityConfig: {
        cloudwatchMetricsEnabled: false,
        metricName: `${projectName}-acl-metric`,
        sampledRequestsEnabled: false,
    },
    tags,
});

new aws.wafv2.WebAclAssociation(`${projectName}-acl-association`, {
    resourceArn: frontendLoadBalancer.loadBalancer.arn,
    webAclArn: webAcl.arn,
});

export const frontendUrl = pulumi.interpolate`http://${frontendLoadBalancer.loadBalancer.dnsName}`;
export const internalApiUrl = pulumi.interpolate`http://${backendLoadBalancer.loadBalancer.dnsName}${apiHealthPath}`;
export const frontendSecurityGroupId = frontendSecurityGroup.id;
export const backendSecurityGroupId = backendSecurityGroup.id;
export const frontendServiceName = frontendService.service.name;
export const backendServiceName = backendService.service.name;
