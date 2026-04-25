import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"
import * as pulumi from "@pulumi/pulumi"

import { createNetwork } from "./lib/network"
import { createLoadBalancers } from "./lib/loadBalancer"
import { createEcsServices } from "./lib/ecs"
import { createWaf } from "./lib/waf"

const projectName = "wcommerce"
const applicationPort = 5000
const httpPort = 80
const apiHealthPath = "/WeatherForecast"

const tags = {
    Name: projectName,
    Project: "WCOMMERCE",
}

// Create network and security groups
const { vpc, frontendSecurityGroup, backendSecurityGroup } = createNetwork({
    projectName,
    cidrBlock: "10.0.0.0/16",
    tags,
})

// Create ECR repositories
const frontendRepository = new awsx.ecr.Repository(`${projectName}-web`, { tags })
const backendRepository = new awsx.ecr.Repository(`${projectName}-api`, { tags })

// Build and push images
const frontendImage = new awsx.ecr.Image(`${projectName}-web`, {
    repositoryUrl: frontendRepository.url,
    path: "./infra-web",
})

const backendImage = new awsx.ecr.Image(`${projectName}-api`, {
    repositoryUrl: backendRepository.url,
    path: "./infra-api",
})

// Create ECS cluster
const cluster = new aws.ecs.Cluster(`${projectName}-cluster`, { tags })

// Create load balancers
const { frontendLoadBalancer, backendLoadBalancer } = createLoadBalancers({
    projectName,
    tags,
    vpc,
    frontendSecurityGroupId: frontendSecurityGroup.id,
    backendSecurityGroupId: backendSecurityGroup.id,
    frontendPort: applicationPort,
    apiHealthPath,
})

// Create ECS services
const { frontendService, backendService } = createEcsServices({
    projectName,
    tags,
    cluster,
    frontendSecurityGroupId: frontendSecurityGroup.id,
    backendSecurityGroupId: backendSecurityGroup.id,
    frontendImageUri: frontendImage.imageUri,
    backendImageUri: backendImage.imageUri,
    vpc,
    backendDnsName: backendLoadBalancer.loadBalancer.dnsName,
    apiHealthPath,
    frontendPort: applicationPort,
    frontendTargetGroupArn: frontendLoadBalancer.defaultTargetGroup.arn,
    backendTargetGroupArn: backendLoadBalancer.defaultTargetGroup.arn,
})

// Create WAFand associate with frontend load balancer
createWaf({
    projectName,
    tags,
    loadBalancerArn: frontendLoadBalancer.loadBalancer.arn,
})

// Exports
export const frontendUrl = pulumi.interpolate`http://${frontendLoadBalancer.loadBalancer.dnsName}`
export const internalApiUrl = pulumi.interpolate`http://${backendLoadBalancer.loadBalancer.dnsName}${apiHealthPath}`
export const frontendSecurityGroupId = frontendSecurityGroup.id
export const backendSecurityGroupId = backendSecurityGroup.id
export const frontendServiceName = frontendService.name
export const backendServiceName = backendService.name
