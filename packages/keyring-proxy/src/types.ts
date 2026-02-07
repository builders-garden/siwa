/**
 * types.ts
 *
 * Type definitions for the policy system.
 * Inspired by Privy's policy engine architecture.
 */

// ---------------------------------------------------------------------------
// Field Sources
// ---------------------------------------------------------------------------

export type FieldSource =
  | 'ethereum_transaction'    // to, value, chain_id, gas, data, nonce, etc.
  | 'ethereum_calldata'       // function_name, function_name.<param>
  | 'message'                 // content, length, is_hex
  | 'ethereum_authorization'  // contract, chain_id
  | 'system';                 // current_unix_timestamp

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export type Operator =
  | 'eq'       // Equal
  | 'neq'      // Not equal
  | 'lt'       // Less than
  | 'lte'      // Less than or equal
  | 'gt'       // Greater than
  | 'gte'      // Greater than or equal
  | 'in'       // Value in array
  | 'not_in'   // Value not in array
  | 'matches'; // Regex match (for strings)

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export interface Condition {
  field_source: FieldSource;
  field: string;
  operator: Operator;
  value: string | number | string[] | number[];
  abi?: object;  // Required for ethereum_calldata to decode function calls
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RuleMethod =
  | 'sign_transaction'
  | 'sign_message'
  | 'sign_authorization'
  | '*';  // Matches all methods

export type RuleAction = 'ALLOW' | 'DENY';

export interface Rule {
  name: string;
  method: RuleMethod;
  action: RuleAction;
  conditions: Condition[];
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export type PolicyVersion = '1.0';
export type ChainType = 'ethereum';

export interface Policy {
  id: string;
  version: PolicyVersion;
  name: string;
  chain_type: ChainType;
  rules: Rule[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Wallet-Policy Bindings
// ---------------------------------------------------------------------------

export interface WalletPolicyBinding {
  wallet_address: string;
  policy_id: string;
  attached_at: string;
}

// ---------------------------------------------------------------------------
// Policy Store Data
// ---------------------------------------------------------------------------

export interface PolicyStoreData {
  policies: Record<string, Policy>;
  bindings: Record<string, string[]>;  // wallet_address -> policy_ids[]
}

// ---------------------------------------------------------------------------
// Evaluation Context
// ---------------------------------------------------------------------------

export interface TransactionContext {
  to?: string;
  value?: string | bigint;
  chain_id?: number;
  gas?: number | bigint;
  gas_price?: string | bigint;
  max_fee_per_gas?: string | bigint;
  max_priority_fee_per_gas?: string | bigint;
  data?: string;
  nonce?: number;
}

export interface CalldataContext {
  function_name?: string;
  [paramPath: string]: unknown;  // function_name.<param>
}

export interface MessageContext {
  content: string;
  length: number;
  is_hex: boolean;
}

export interface AuthorizationContext {
  contract: string;
  chain_id?: number;
}

export interface SystemContext {
  current_unix_timestamp: number;
}

export interface EvaluationContext {
  ethereum_transaction?: TransactionContext;
  ethereum_calldata?: CalldataContext;
  message?: MessageContext;
  ethereum_authorization?: AuthorizationContext;
  system: SystemContext;
}

// ---------------------------------------------------------------------------
// Evaluation Results
// ---------------------------------------------------------------------------

export interface RuleEvaluationResult {
  fires: boolean;
  action: RuleAction;
  rule_name: string;
}

export interface PolicyEvaluationResult {
  policy_id: string;
  policy_name: string;
  allowed: boolean;
  reason?: string;
  matched_rule?: string;
}

export interface EvaluationResult {
  allowed: boolean;
  reason: string;
  denied_by?: string;      // Rule name that denied
  allowed_by?: string;     // Rule name that allowed
  policy_id?: string;      // Policy that made the decision
  evaluated_policies: string[];
}

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export interface CreatePolicyRequest {
  name: string;
  rules: Rule[];
  version?: PolicyVersion;
  chain_type?: ChainType;
}

export interface CreatePolicyResponse {
  id: string;
  policy: Policy;
}

export interface PolicyViolationResponse {
  error: 'Policy violation';
  reason: string;
  denied_by?: string;
  policy_id?: string;
}
