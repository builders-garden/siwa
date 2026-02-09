// Request types
export type Operation = "sign-message" | "sign-transaction" | "sign-authorization";

export interface ApprovalRequest {
  requestId: string;
  operation: Operation;
  wallet: string;
  payload: TransactionPayload | MessagePayload | AuthorizationPayload;
  chainId?: number;
}

export interface TransactionPayload {
  to?: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface MessagePayload {
  message: string;
}

export interface AuthorizationPayload {
  address: string;
  chainId?: number;
  nonce?: number;
}

// Response types
export interface ApprovalResult {
  approved: boolean;
  reason?: string;
  responseTimeMs?: number;
}

// Internal types
export interface PendingApproval {
  requestId: string;
  operation: Operation;
  wallet: string;
  payload: unknown;
  decodedData?: string;
  createdAt: Date;
  expiresAt: Date;
  telegramMessageId: number;
  chatId: string;
  resolve: (result: ApprovalResult) => void;
  timeoutId: NodeJS.Timeout;
}

// Telegram types
export interface TelegramUpdate {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

// Audit log types
export type AuditEvent =
  | "request_created"
  | "user_approved"
  | "user_rejected"
  | "request_timeout"
  | "webhook_received"
  | "telegram_error";

export interface AuditLogEntry {
  timestamp: string;
  event: AuditEvent;
  requestId?: string;
  operation?: Operation;
  wallet?: string;
  to?: string;
  value?: string;
  chainId?: number;
  telegramMessageId?: number;
  responseTimeMs?: number;
  telegramUserId?: number;
  callbackId?: string;
  action?: string;
  error?: string;
  endpoint?: string;
}
