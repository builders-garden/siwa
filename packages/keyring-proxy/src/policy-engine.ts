/**
 * policy-engine.ts
 *
 * Policy evaluation engine inspired by Privy's policy system.
 *
 * Evaluation logic:
 * 1. Any DENY rule fires → REJECT immediately
 * 2. Any ALLOW rule fires (no DENY) → APPROVE
 * 3. No rules fire → DENY (default closed)
 */

import type {
  Policy,
  Rule,
  Condition,
  RuleMethod,
  EvaluationContext,
  EvaluationResult,
  Operator,
} from './types.js';
import { extractField } from './field-extractors.js';

// ---------------------------------------------------------------------------
// Condition Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single condition against the context.
 * Returns true if the condition is satisfied.
 */
export function evaluateCondition(
  condition: Condition,
  context: EvaluationContext
): boolean {
  const fieldValue = extractField(
    context,
    condition.field_source,
    condition.field,
    condition.abi
  );

  // If field value is undefined, condition cannot be satisfied
  if (fieldValue === undefined) {
    return false;
  }

  return compareValues(fieldValue, condition.operator, condition.value);
}

/**
 * Compare a field value against a condition value using the specified operator.
 */
function compareValues(
  fieldValue: unknown,
  operator: Operator,
  conditionValue: string | number | string[] | number[]
): boolean {
  switch (operator) {
    case 'eq':
      return isEqual(fieldValue, conditionValue);

    case 'neq':
      return !isEqual(fieldValue, conditionValue);

    case 'lt':
      return compareMagnitude(fieldValue, conditionValue) < 0;

    case 'lte':
      return compareMagnitude(fieldValue, conditionValue) <= 0;

    case 'gt':
      return compareMagnitude(fieldValue, conditionValue) > 0;

    case 'gte':
      return compareMagnitude(fieldValue, conditionValue) >= 0;

    case 'in':
      return isIn(fieldValue, conditionValue);

    case 'not_in':
      return !isIn(fieldValue, conditionValue);

    case 'matches':
      return matchesPattern(fieldValue, conditionValue);

    default:
      return false;
  }
}

/**
 * Check equality between field value and condition value.
 * Handles address normalization and numeric comparisons.
 */
function isEqual(fieldValue: unknown, conditionValue: unknown): boolean {
  // Normalize both values for comparison
  const normalizedField = normalizeForComparison(fieldValue);
  const normalizedCondition = normalizeForComparison(conditionValue);

  return normalizedField === normalizedCondition;
}

/**
 * Compare numeric values, returns -1, 0, or 1.
 * Works with strings representing large numbers (wei values).
 */
function compareMagnitude(fieldValue: unknown, conditionValue: unknown): number {
  const fieldNum = toBigInt(fieldValue);
  const conditionNum = toBigInt(conditionValue);

  if (fieldNum === null || conditionNum === null) {
    return 0; // Cannot compare, treat as equal (condition fails for lt/gt)
  }

  if (fieldNum < conditionNum) return -1;
  if (fieldNum > conditionNum) return 1;
  return 0;
}

/**
 * Check if field value is in the condition array.
 */
function isIn(fieldValue: unknown, conditionValue: unknown): boolean {
  if (!Array.isArray(conditionValue)) {
    return false;
  }

  const normalizedField = normalizeForComparison(fieldValue);

  return conditionValue.some(v =>
    normalizeForComparison(v) === normalizedField
  );
}

/**
 * Check if field value matches a regex pattern.
 */
function matchesPattern(fieldValue: unknown, conditionValue: unknown): boolean {
  if (typeof fieldValue !== 'string' || typeof conditionValue !== 'string') {
    return false;
  }

  try {
    const regex = new RegExp(conditionValue);
    return regex.test(fieldValue);
  } catch {
    return false;
  }
}

/**
 * Normalize a value for comparison.
 * - Addresses: lowercase
 * - Numbers: string representation
 * - Booleans: string "true"/"false"
 */
function normalizeForComparison(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    // Lowercase addresses
    if (value.startsWith('0x') && value.length === 42) {
      return value.toLowerCase();
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value.toString();
  }

  return String(value);
}

/**
 * Convert a value to BigInt for numeric comparisons.
 */
function toBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    return BigInt(Math.floor(value));
  }

  if (typeof value === 'string') {
    try {
      // Handle hex strings
      if (value.startsWith('0x')) {
        return BigInt(value);
      }
      // Handle decimal strings
      return BigInt(value);
    } catch {
      return null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Rule Evaluation
// ---------------------------------------------------------------------------

/**
 * Check if a rule applies to the given method.
 */
function ruleMatchesMethod(rule: Rule, method: RuleMethod): boolean {
  return rule.method === '*' || rule.method === method;
}

/**
 * Evaluate a rule against the context.
 * A rule "fires" if ALL its conditions are satisfied.
 */
export function evaluateRule(
  rule: Rule,
  method: RuleMethod,
  context: EvaluationContext
): { fires: boolean; action: 'ALLOW' | 'DENY'; rule_name: string } {
  // Check if rule applies to this method
  if (!ruleMatchesMethod(rule, method)) {
    return { fires: false, action: rule.action, rule_name: rule.name };
  }

  // Empty conditions = always fires
  if (rule.conditions.length === 0) {
    return { fires: true, action: rule.action, rule_name: rule.name };
  }

  // All conditions must be satisfied (AND logic)
  const allConditionsMet = rule.conditions.every(condition =>
    evaluateCondition(condition, context)
  );

  return { fires: allConditionsMet, action: rule.action, rule_name: rule.name };
}

// ---------------------------------------------------------------------------
// Policy Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single policy against the context.
 */
export function evaluatePolicy(
  policy: Policy,
  method: RuleMethod,
  context: EvaluationContext
): { allowed: boolean; reason?: string; matched_rule?: string } {
  let hasAllowRule = false;
  let allowRuleName: string | undefined;

  for (const rule of policy.rules) {
    const result = evaluateRule(rule, method, context);

    if (result.fires) {
      if (result.action === 'DENY') {
        // DENY takes precedence - reject immediately
        return {
          allowed: false,
          reason: `Denied by rule: ${result.rule_name}`,
          matched_rule: result.rule_name,
        };
      } else {
        // ALLOW - remember it but keep checking for DENY rules
        hasAllowRule = true;
        allowRuleName = result.rule_name;
      }
    }
  }

  if (hasAllowRule) {
    return {
      allowed: true,
      reason: `Allowed by rule: ${allowRuleName}`,
      matched_rule: allowRuleName,
    };
  }

  // No rules fired - no decision from this policy
  return {
    allowed: false,
    reason: 'No matching rules',
  };
}

// ---------------------------------------------------------------------------
// Multi-Policy Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate multiple policies against the context.
 *
 * Logic (Privy-style):
 * 1. Any DENY from any policy → REJECT
 * 2. Any ALLOW from any policy (and no DENY) → APPROVE
 * 3. No rules fire → DENY (default closed)
 */
export function evaluatePolicies(
  policies: Policy[],
  method: RuleMethod,
  context: EvaluationContext
): EvaluationResult {
  const evaluatedPolicies: string[] = [];
  let hasAllow = false;
  let allowedBy: string | undefined;
  let allowPolicyId: string | undefined;

  // No policies = deny by default
  if (policies.length === 0) {
    return {
      allowed: false,
      reason: 'No policies attached to wallet',
      evaluated_policies: [],
    };
  }

  for (const policy of policies) {
    evaluatedPolicies.push(policy.id);

    for (const rule of policy.rules) {
      const result = evaluateRule(rule, method, context);

      if (result.fires) {
        if (result.action === 'DENY') {
          // DENY wins immediately
          return {
            allowed: false,
            reason: `Denied by rule "${result.rule_name}" in policy "${policy.name}"`,
            denied_by: result.rule_name,
            policy_id: policy.id,
            evaluated_policies: evaluatedPolicies,
          };
        } else {
          // Remember ALLOW, but keep checking all policies for DENY
          if (!hasAllow) {
            hasAllow = true;
            allowedBy = result.rule_name;
            allowPolicyId = policy.id;
          }
        }
      }
    }
  }

  if (hasAllow) {
    return {
      allowed: true,
      reason: `Allowed by rule "${allowedBy}"`,
      allowed_by: allowedBy,
      policy_id: allowPolicyId,
      evaluated_policies: evaluatedPolicies,
    };
  }

  // No rules fired from any policy
  return {
    allowed: false,
    reason: 'No ALLOW rules matched',
    evaluated_policies: evaluatedPolicies,
  };
}
