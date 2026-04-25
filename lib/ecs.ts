import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"
import * as pulumi from "@pulumi/pulumi"

export interface EcsConfig {
    projectName: string
    tags: Record<string, string>
    cluster: aws.ecs.Cluster
    frontendSecurityGroupId: pulumi.Output<string>
    backendSecurityGroupId: pulumi.Output<string>
    frontendImageUri: pulumi.Output<string>
    backendImageUri: pulumi.Output<string>
    vpc: awsx.ec2.Vpc
    backendDnsName: pulumi.Output<string>
    apiHealthPath: string
    frontendPort: number
    frontendTargetGroupArn: pulumi.Output<string>
    backendTargetGroupArn: pulumi.Output<string>
}

export interface EcsResources {
    frontendTaskDefinition: awsx.ecs.FargateTaskDefinition
    backendTaskDefinition: awsx.ecs.FargateTaskDefinition
    frontendService: aws.ecs.Service
    backendService: aws.ecs.Service
}

export function createEcsServices(config: EcsConfig): EcsResources {
    const { projectName, tags, cluster, frontendSecurityGroupId, backendSecurityGroupId, 
            frontendImageUri, backendImageUri, vpc, backendDnsName, apiHealthPath, 
            frontendPort, frontendTargetGroupArn, backendTargetGroupArn } = config

    const frontendTaskDefinition = new awsx.ecs.FargateTaskDefinition(`${projectName}-web-td`, {
        tags,
        containers: {
            infrawweb: {
                image: frontendImageUri,
                name: "woo-web",
                cpu: 512,
                memory: 128,
                environment: [
                    {
                        name: "ApiAddress",
                        value: pulumi.interpolate`http://${backendDnsName}${apiHealthPath}`,
                    },
                ],
                portMappings: [
                    {
                        containerPort: frontendPort,
                        hostPort: frontendPort,
                    },
                ],
            },
        },
    })

    const backendTaskDefinition = new awsx.ecs.FargateTaskDefinition(`${projectName}-api-td`, {
        tags,
        containers: {
            infrawapi: {
                image: backendImageUri,
                name: "woo-api",
                cpu: 512,
                memory: 128,
                portMappings: [
                    {
                        containerPort: frontendPort,
                        hostPort: frontendPort,
                    },
                ],
            },
        },
    })

    const frontendService = new aws.ecs.Service(`${projectName}-web-srv`, {
        cluster: cluster.arn,
        desiredCount: 2,
        taskDefinition: frontendTaskDefinition.taskDefinition.arn,
        launchType: "FARGATE",
        networkConfiguration: {
            assignPublicIp: false,
            subnets: vpc.privateSubnetIds,
            securityGroups: [frontendSecurityGroupId],
        },
        loadBalancers: [
            {
                targetGroupArn: frontendTargetGroupArn,
                containerName: "infrawweb",
                containerPort: frontendPort,
            },
        ],
    })

    const backendService = new aws.ecs.Service(`${projectName}-api-srv`, {
        cluster: cluster.arn,
        desiredCount: 2,
        taskDefinition: backendTaskDefinition.taskDefinition.arn,
        launchType: "FARGATE",
        networkConfiguration: {
            assignPublicIp: false,
            subnets: vpc.privateSubnetIds,
            securityGroups: [backendSecurityGroupId],
        },
        loadBalancers: [
            {
                targetGroupArn: backendTargetGroupArn,
                containerName: "infrawapi",
                containerPort: frontendPort,
            },
        ],
    })

    return { frontendTaskDefinition, backendTaskDefinition, frontendService, backendService }
}
