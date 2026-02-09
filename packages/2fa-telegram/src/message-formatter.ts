import type {
  ApprovalRequest,
  TransactionPayload,
  MessagePayload,
  AuthorizationPayload,
} from "./types.js";
import {
  decodeTransactionData,
  formatValue,
  truncateAddress,
  getChainName,
} from "./transaction-decoder.js";
import { TFA_APPROVAL_TIMEOUT_MS } from "./config.js";

export async function formatApprovalMessage(
  request: ApprovalRequest
): Promise<string> {
  const timeoutSeconds = Math.floor(TFA_APPROVAL_TIMEOUT_MS / 1000);
  const chainName = request.chainId
    ? getChainName(request.chainId)
    : "Unknown chain";

  let details = "";

  switch (request.operation) {
    case "sign-transaction":
      details = await formatTransactionDetails(
        request.payload as TransactionPayload,
        chainName
      );
      break;
    case "sign-message":
      details = formatMessageDetails(request.payload as MessagePayload);
      break;
    case "sign-authorization":
      details = formatAuthorizationDetails(
        request.payload as AuthorizationPayload,
        chainName
      );
      break;
  }

  return `🔐 <b>SIWA Signing Request</b>

📋 Request ID: <code>${request.requestId}</code>
⏱️ Expires: ${timeoutSeconds} seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 <b>Wallet</b>
<code>${request.wallet}</code>

📝 <b>Operation</b>
${formatOperationName(request.operation)}

⛓️ <b>Chain</b>
${chainName}${request.chainId ? ` (${request.chainId})` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${details}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

async function formatTransactionDetails(
  tx: TransactionPayload,
  chainName: string
): Promise<string> {
  const decodedData = await decodeTransactionData(tx.data);

  let details = "";

  if (tx.to) {
    details += `
📤 <b>To</b>
<code>${tx.to}</code>
`;
  }

  details += `
💰 <b>Value</b>
${formatValue(tx.value)}
`;

  if (tx.data && tx.data !== "0x") {
    details += `
📦 <b>Data</b>
<code>${decodedData}</code>
`;
  }

  if (tx.nonce !== undefined) {
    details += `
🔢 <b>Nonce</b>
${tx.nonce}
`;
  }

  return details;
}

function formatMessageDetails(msg: MessagePayload): string {
  // Truncate long messages for display
  const maxLength = 500;
  const displayMessage =
    msg.message.length > maxLength
      ? `${msg.message.slice(0, maxLength)}...`
      : msg.message;

  // Escape HTML entities
  const escaped = escapeHtml(displayMessage);

  return `
📨 <b>Message</b>
<pre>${escaped}</pre>
`;
}

function formatAuthorizationDetails(
  auth: AuthorizationPayload,
  chainName: string
): string {
  return `
🔗 <b>Delegate To</b>
<code>${auth.address}</code>

${auth.nonce !== undefined ? `🔢 <b>Nonce</b>\n${auth.nonce}\n` : ""}`;
}

function formatOperationName(operation: string): string {
  switch (operation) {
    case "sign-transaction":
      return "Sign Transaction";
    case "sign-message":
      return "Sign Message";
    case "sign-authorization":
      return "Sign Authorization (EIP-7702)";
    default:
      return operation;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatApprovedMessage(
  requestId: string,
  operation: string,
  wallet: string,
  responseTimeMs: number
): string {
  return `✅ <b>APPROVED</b>

Request ID: <code>${requestId}</code>
Operation: ${formatOperationName(operation)}
Wallet: <code>${truncateAddress(wallet)}</code>
Response time: ${(responseTimeMs / 1000).toFixed(1)}s`;
}

export function formatRejectedMessage(
  requestId: string,
  operation: string,
  wallet: string,
  responseTimeMs: number
): string {
  return `❌ <b>REJECTED</b>

Request ID: <code>${requestId}</code>
Operation: ${formatOperationName(operation)}
Wallet: <code>${truncateAddress(wallet)}</code>
Response time: ${(responseTimeMs / 1000).toFixed(1)}s`;
}

export function formatExpiredMessage(
  requestId: string,
  operation: string,
  wallet: string,
  timeoutSeconds: number
): string {
  return `⏰ <b>EXPIRED</b>

Request ID: <code>${requestId}</code>
Operation: ${formatOperationName(operation)}
Wallet: <code>${truncateAddress(wallet)}</code>
No response within ${timeoutSeconds}s`;
}
