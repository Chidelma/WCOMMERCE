import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"

export interface NetworkConfig {
    projectName: string
    cidrBlock: string
    tags: Record<string, string>
}

export interface NetworkResources {
    vpc: awsx.ec2.Vpc
    frontendSecurityGroup: aws.ec2.SecurityGroup
    backendSecurityGroup: aws.ec2.SecurityGroup
}

export function createNetwork(config: NetworkConfig): NetworkResources {
    const vpc = new awsx.ec2.Vpc(`${config.projectName}-vpc`, {
        cidrBlock: config.cidrBlock,
        instanceTenancy: "default",
        tags: config.tags,
    })

    const frontendSecurityGroup = new aws.ec2.SecurityGroup(`${config.projectName}-frontend-sg`, {
        vpcId: vpc.vpcId,
        description: "Security boundary for the public storefront load balancer and private web tasks.",
        ingress: [
            {
                description: "Allow public HTTP traffic to the storefront load balancer.",
                fromPort: 80,
                toPort: 80,
                protocol: "tcp",
                cidrBlocks: ["0.0.0.0/0"],
            },
            {
                description: "Allow the storefront load balancer to reach the web tasks.",
                fromPort: 5000,
                toPort: 5000,
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
            ...config.tags,
            Role: "frontend",
        },
    })

    const backendSecurityGroup = new aws.ec2.SecurityGroup(`${config.projectName}-backend-sg`, {
        vpcId: vpc.vpcId,
        description: "Security boundary for the internal API load balancer and private API tasks.",
        ingress: [
            {
                description: "Allow web tasks to call the internal API load balancer.",
                fromPort: 80,
                toPort: 80,
                protocol: "tcp",
                securityGroups: [frontendSecurityGroup.id],
            },
            {
                description: "Allow the internal API load balancer to reach the API tasks.",
                fromPort: 5000,
                toPort: 5000,
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
            ...config.tags,
            Role: "backend",
        },
    })

    return { vpc, frontendSecurityGroup, backendSecurityGroup }
}
