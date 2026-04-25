import * as aws from "@pulumi/aws"
import * as awsx from "@pulumi/awsx"
import * as pulumi from "@pulumi/pulumi"

export interface LoadBalancerConfig {
    projectName: string
    tags: Record<string, string>
    vpc: awsx.ec2.Vpc
    frontendSecurityGroupId: pulumi.Input<string>
    backendSecurityGroupId: pulumi.Input<string>
    frontendPort: number
    apiHealthPath: string
}

export interface LoadBalancerResources {
    frontendLoadBalancer: awsx.lb.ApplicationLoadBalancer
    backendLoadBalancer: awsx.lb.ApplicationLoadBalancer
}

export function createLoadBalancers(config: LoadBalancerConfig): LoadBalancerResources {
    const { projectName, tags, vpc, frontendSecurityGroupId, backendSecurityGroupId, 
            frontendPort, apiHealthPath } = config

    const frontendLoadBalancer = new awsx.lb.ApplicationLoadBalancer(`${projectName}-web-lb`, {
        tags,
        subnetIds: vpc.publicSubnetIds,
        securityGroups: [frontendSecurityGroupId],
        defaultTargetGroup: {
            port: frontendPort,
            protocol: "HTTP",
            targetType: "ip",
            healthCheck: {
                path: "/",
            },
        },
    })

    const backendLoadBalancer = new awsx.lb.ApplicationLoadBalancer(`${projectName}-api-lb`, {
        tags,
        internal: true,
        subnetIds: vpc.privateSubnetIds,
        securityGroups: [backendSecurityGroupId],
        defaultTargetGroup: {
            port: frontendPort,
            protocol: "HTTP",
            targetType: "ip",
            healthCheck: {
                path: apiHealthPath,
            },
        },
    })

    return { frontendLoadBalancer, backendLoadBalancer }
}
