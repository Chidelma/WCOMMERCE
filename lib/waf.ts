import * as aws from "@pulumi/aws"
import * as pulumi from "@pulumi/pulumi"

export interface WafConfig {
    projectName: string
    tags: Record<string, string>
    loadBalancerArn: pulumi.Input<string>
}

export function createWaf(config: WafConfig): aws.wafv2.WebAclAssociation {
    const { projectName, tags, loadBalancerArn } = config

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
    })

    return new aws.wafv2.WebAclAssociation(`${projectName}-acl-association`, {
        resourceArn: loadBalancerArn,
        webAclArn: webAcl.arn,
    })
}
