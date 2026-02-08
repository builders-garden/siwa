// Policy types for the admin dashboard

export interface Policy {
  id: string;
  name: string;
  description: string;
  type: "allow" | "deny" | "limit";
  scope: "global" | "agent" | "action";
  rules: PolicyRule[];
  status: "active" | "draft" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface PolicyRule {
  id: string;
  field: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "regex" | "gt" | "lt" | "gte" | "lte";
  value: string;
}

export interface PolicyProposal {
  id: string;
  name: string;
  description: string;
  rationale: string;
  policy: Omit<Policy, "id" | "createdAt" | "updatedAt" | "status">;
  confidence: number;
  tags: string[];
}

// Sample policies for demonstration
export const samplePolicies: Policy[] = [
  {
    id: "pol_1",
    name: "Rate Limit API Calls",
    description: "Limit agents to 100 API calls per minute to prevent abuse",
    type: "limit",
    scope: "global",
    rules: [
      { id: "rule_1", field: "calls_per_minute", operator: "lte", value: "100" },
    ],
    status: "active",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-20T14:30:00Z",
  },
  {
    id: "pol_2",
    name: "Block Unauthorized Domains",
    description: "Deny requests from agents not registered on approved domains",
    type: "deny",
    scope: "agent",
    rules: [
      { id: "rule_2", field: "domain", operator: "regex", value: "^(?!.*\\.(trusted\\.com|verified\\.io)$).*$" },
    ],
    status: "active",
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-01-10T08:00:00Z",
  },
  {
    id: "pol_3",
    name: "Allow Token Transfers",
    description: "Allow agents to perform token transfer actions",
    type: "allow",
    scope: "action",
    rules: [
      { id: "rule_3", field: "action_type", operator: "equals", value: "token_transfer" },
      { id: "rule_4", field: "amount", operator: "lte", value: "1000" },
    ],
    status: "active",
    createdAt: "2025-01-12T12:00:00Z",
    updatedAt: "2025-01-18T09:15:00Z",
  },
  {
    id: "pol_4",
    name: "Restrict High-Value Transactions",
    description: "Require additional verification for transactions over 10,000 units",
    type: "limit",
    scope: "action",
    rules: [
      { id: "rule_5", field: "transaction_value", operator: "gt", value: "10000" },
    ],
    status: "draft",
    createdAt: "2025-01-22T16:00:00Z",
    updatedAt: "2025-01-22T16:00:00Z",
  },
  {
    id: "pol_5",
    name: "Deny Deprecated Endpoints",
    description: "Block access to deprecated API endpoints",
    type: "deny",
    scope: "global",
    rules: [
      { id: "rule_6", field: "endpoint", operator: "startsWith", value: "/api/v1/" },
    ],
    status: "disabled",
    createdAt: "2024-12-01T10:00:00Z",
    updatedAt: "2025-01-05T11:00:00Z",
  },
];

// AI-proposed policies for demonstration
export const proposedPolicies: PolicyProposal[] = [
  {
    id: "prop_1",
    name: "Geo-Restricted Access",
    description: "Restrict agent access based on geographic location for compliance",
    rationale: "Based on your current traffic patterns, 95% of legitimate requests come from US and EU regions. Restricting other regions could reduce unauthorized access attempts by ~40%.",
    policy: {
      name: "Geo-Restricted Access",
      description: "Restrict agent access based on geographic location for compliance",
      type: "deny",
      scope: "global",
      rules: [
        { id: "prop_rule_1", field: "geo_region", operator: "regex", value: "^(?!(US|EU|GB|CA)$).*$" },
      ],
    },
    confidence: 0.87,
    tags: ["security", "compliance", "geographic"],
  },
  {
    id: "prop_2",
    name: "Time-Based Rate Limiting",
    description: "Apply stricter rate limits during off-peak hours",
    rationale: "Analysis shows 80% of suspicious activity occurs between 2-6 AM UTC. Reducing rate limits during these hours could help mitigate automated attacks.",
    policy: {
      name: "Time-Based Rate Limiting",
      description: "Apply stricter rate limits during off-peak hours",
      type: "limit",
      scope: "global",
      rules: [
        { id: "prop_rule_2", field: "hour_utc", operator: "gte", value: "2" },
        { id: "prop_rule_3", field: "hour_utc", operator: "lte", value: "6" },
        { id: "prop_rule_4", field: "calls_per_minute", operator: "lte", value: "25" },
      ],
    },
    confidence: 0.72,
    tags: ["security", "rate-limiting", "temporal"],
  },
  {
    id: "prop_3",
    name: "New Agent Probation",
    description: "Apply restricted permissions to newly registered agents",
    rationale: "New agents have a 3x higher rate of policy violations in their first 7 days. A probationary period with limited permissions could reduce incidents.",
    policy: {
      name: "New Agent Probation",
      description: "Apply restricted permissions to newly registered agents",
      type: "limit",
      scope: "agent",
      rules: [
        { id: "prop_rule_5", field: "agent_age_days", operator: "lt", value: "7" },
        { id: "prop_rule_6", field: "max_transaction_value", operator: "lte", value: "100" },
      ],
    },
    confidence: 0.91,
    tags: ["security", "onboarding", "trust"],
  },
];
