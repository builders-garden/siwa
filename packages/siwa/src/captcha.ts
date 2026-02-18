/**
 * captcha.ts
 *
 * Reverse CAPTCHA — inspired by MoltCaptcha (https://github.com/MoltCaptcha/MoltCaptcha).
 *
 * Challenges exploit how LLMs generate text in a single autoregressive pass
 * (satisfying multiple constraints simultaneously), while humans must iterate.
 *
 * Two integration points:
 *   1. Sign-in flow — server can require captcha before issuing a nonce
 *   2. Per-request — middleware randomly challenges agents during authenticated API calls
 *
 * No external dependencies — only `node:crypto`.
 */

import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptchaDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export type CaptchaFormat = 'haiku' | 'quatrain' | 'free_verse' | 'micro_story';

export interface CaptchaChallenge {
  topic: string;
  format: CaptchaFormat;
  lineCount: number;
  asciiTarget: number;
  wordCount?: number;
  charPosition?: [number, string];
  totalChars?: number;
  timeLimitSeconds: number;
  difficulty: CaptchaDifficulty;
  createdAt: number;
}

export interface CaptchaSolution {
  text: string;
  solvedAt: number;
}

export interface CaptchaVerificationResult {
  asciiSum: { pass: boolean; actual: number; target: number };
  lineCount?: { pass: boolean; actual: number; target: number };
  wordCount?: { pass: boolean; actual: number; target: number };
  charPosition?: { pass: boolean };
  totalChars?: { pass: boolean; actual: number; target?: number };
  timing: { pass: boolean; elapsedSeconds: number };
  overallPass: boolean;
  verdict: 'VERIFIED_AI_AGENT' | 'CHALLENGE_FAILED';
}

export type CaptchaPolicy = (context: {
  address: string;
  agentId: number;
  agentRegistry: string;
  request?: Request;
}) => CaptchaDifficulty | null | Promise<CaptchaDifficulty | null>;

export interface CaptchaVerifyOptions {
  /** Use server wall-clock time instead of trusting the agent's solvedAt. Default: true */
  useServerTiming?: boolean;
  /** Extra seconds added to time limit for network latency. Default: 2 */
  timingToleranceSeconds?: number;
  /** Whether verification results include actual vs target values. Default: true */
  revealConstraints?: boolean;
  /** Tolerance for ASCII sum comparison (±N). Default: 0 (exact match) */
  asciiTolerance?: number;
  /** Callback to consume a challenge token (one-time use). Return false to reject replays. */
  consumeChallenge?: (challengeToken: string) => boolean | Promise<boolean>;
}

export interface CaptchaOptions {
  secret: string;
  topics?: string[];
  formats?: CaptchaFormat[];
  /** Override difficulty settings per tier */
  difficulties?: Partial<Record<CaptchaDifficulty, Partial<DifficultyConfig>>>;
  /** Verification options (passed through to verifyCaptchaSolution) */
  verify?: CaptchaVerifyOptions;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CHALLENGE_HEADER = 'X-SIWA-Challenge';
export const CHALLENGE_RESPONSE_HEADER = 'X-SIWA-Challenge-Response';

const DEFAULT_TOPICS: string[] = [
  'quantum computing',
  'neural networks',
  'blockchain consensus',
  'compiler optimization',
  'distributed systems',
  'cryptographic hashing',
  'orbital mechanics',
  'gene editing',
  'photonic circuits',
  'autonomous navigation',
  'protein folding',
  'dark matter',
  'fusion reactors',
  'swarm robotics',
  'topological insulators',
  'zero-knowledge proofs',
];

const DEFAULT_FORMATS: CaptchaFormat[] = ['haiku', 'quatrain', 'free_verse', 'micro_story'];

export interface DifficultyConfig {
  timeLimitSeconds: number;
  lineCount: [number, number]; // [min, max]
  useWordCount: boolean;
  useCharPosition: boolean;
  useTotalChars: boolean;
}

const DIFFICULTY_TABLE: Record<CaptchaDifficulty, DifficultyConfig> = {
  easy: {
    timeLimitSeconds: 30,
    lineCount: [3, 4],
    useWordCount: false,
    useCharPosition: false,
    useTotalChars: false,
  },
  medium: {
    timeLimitSeconds: 20,
    lineCount: [4, 6],
    useWordCount: true,
    useCharPosition: false,
    useTotalChars: false,
  },
  hard: {
    timeLimitSeconds: 15,
    lineCount: [4, 6],
    useWordCount: true,
    useCharPosition: true,
    useTotalChars: false,
  },
  extreme: {
    timeLimitSeconds: 10,
    lineCount: [5, 7],
    useWordCount: true,
    useCharPosition: true,
    useTotalChars: true,
  },
};

const FORMAT_LINE_COUNTS: Record<CaptchaFormat, number> = {
  haiku: 3,
  quatrain: 4,
  free_verse: 5,
  micro_story: 4,
};

// ---------------------------------------------------------------------------
// HMAC token helpers (same pattern as receipt.ts)
// ---------------------------------------------------------------------------

function signToken(payload: object, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string, secret: string): Record<string, unknown> | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return min + (crypto.randomInt(max - min + 1));
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[crypto.randomInt(arr.length)];
}

// ---------------------------------------------------------------------------
// Server-side: challenge generation
// ---------------------------------------------------------------------------

/**
 * Generate a captcha challenge and HMAC-signed token.
 *
 * @param difficulty  Challenge difficulty tier
 * @param options     Secret for HMAC signing + optional topic/format pools
 * @returns           `{ challenge, challengeToken }` — the challenge data and its signed token
 */
export function createCaptchaChallenge(
  difficulty: CaptchaDifficulty,
  options: CaptchaOptions,
): { challenge: CaptchaChallenge; challengeToken: string } {
  const baseConfig = DIFFICULTY_TABLE[difficulty];
  const overrides = options.difficulties?.[difficulty];
  const config: DifficultyConfig = overrides ? { ...baseConfig, ...overrides } : baseConfig;
  const topics = options.topics ?? DEFAULT_TOPICS;
  const formats = options.formats ?? DEFAULT_FORMATS;

  const topic = randomChoice(topics);
  const format = randomChoice(formats);
  const lineCount = FORMAT_LINE_COUNTS[format] ?? randomInt(config.lineCount[0], config.lineCount[1]);

  // ASCII target: sum of first-char ASCII values, plausible range for uppercase/lowercase letters
  // Each line starts with a letter (65-122), so target is roughly lineCount * 65..122
  const asciiTarget = randomInt(lineCount * 65, lineCount * 122);

  const challenge: CaptchaChallenge = {
    topic,
    format,
    lineCount,
    asciiTarget,
    timeLimitSeconds: config.timeLimitSeconds,
    difficulty,
    createdAt: Date.now(),
  };

  if (config.useWordCount) {
    // Target word count: reasonable range for the format
    challenge.wordCount = randomInt(lineCount * 3, lineCount * 7);
  }

  if (config.useCharPosition) {
    // Pick a character position in flattened text and require a specific letter
    const pos = randomInt(5, 30);
    const charCode = randomInt(97, 122); // lowercase a-z
    challenge.charPosition = [pos, String.fromCharCode(charCode)];
  }

  if (config.useTotalChars) {
    // Total character count (excluding newlines)
    challenge.totalChars = randomInt(lineCount * 15, lineCount * 40);
  }

  const challengeToken = signToken(challenge, options.secret);
  return { challenge, challengeToken };
}

// ---------------------------------------------------------------------------
// Server-side: solution verification
// ---------------------------------------------------------------------------

/**
 * Verify a captcha solution against a signed challenge token.
 *
 * @param challengeToken  HMAC-signed token from createCaptchaChallenge
 * @param solution        The agent's solution (text + timestamp)
 * @param secret          HMAC secret used to sign the token
 * @param options         Verification options (timing, tolerance, replay protection, redaction)
 * @returns               Verification result, or `null` if the token is invalid/replayed
 */
export async function verifyCaptchaSolution(
  challengeToken: string,
  solution: CaptchaSolution,
  secret: string,
  options?: CaptchaVerifyOptions,
): Promise<CaptchaVerificationResult | null> {
  const payload = verifyToken(challengeToken, secret);
  if (!payload) return null;

  // One-time use: consume the challenge token if a store is provided
  if (options?.consumeChallenge) {
    const consumed = await options.consumeChallenge(challengeToken);
    if (!consumed) return null; // replay rejected
  }

  const challenge = payload as unknown as CaptchaChallenge;
  const lines = solution.text.split('\n').filter(l => l.length > 0);
  const flatText = lines.join('');

  const reveal = options?.revealConstraints ?? true;
  const asciiTolerance = options?.asciiTolerance ?? 0;

  // 1. ASCII sum of first characters
  const firstChars = lines.map(l => l.charCodeAt(0));
  const actualAsciiSum = firstChars.reduce((sum, c) => sum + c, 0);
  const asciiPass = Math.abs(actualAsciiSum - challenge.asciiTarget) <= asciiTolerance;

  const result: CaptchaVerificationResult = {
    asciiSum: {
      pass: asciiPass,
      actual: reveal ? actualAsciiSum : 0,
      target: reveal ? challenge.asciiTarget : 0,
    },
    timing: { pass: false, elapsedSeconds: 0 },
    overallPass: false,
    verdict: 'CHALLENGE_FAILED',
  };

  // 2. Line count check
  const lineCountPass = lines.length === challenge.lineCount;
  result.lineCount = {
    pass: lineCountPass,
    actual: reveal ? lines.length : 0,
    target: reveal ? challenge.lineCount : 0,
  };

  // 3. Word count
  let wordCountPass = true;
  if (challenge.wordCount !== undefined) {
    const words = solution.text.split(/\s+/).filter(w => w.length > 0);
    const actualWordCount = words.length;
    wordCountPass = actualWordCount === challenge.wordCount;
    result.wordCount = {
      pass: wordCountPass,
      actual: reveal ? actualWordCount : 0,
      target: reveal ? challenge.wordCount : 0,
    };
  }

  // 4. Character at position
  let charPositionPass = true;
  if (challenge.charPosition) {
    const [pos, expectedChar] = challenge.charPosition;
    const actualChar = flatText[pos] ?? '';
    charPositionPass = actualChar === expectedChar;
    result.charPosition = { pass: charPositionPass };
  }

  // 5. Total chars (excluding newlines)
  let totalCharsPass = true;
  if (challenge.totalChars !== undefined) {
    const actualTotalChars = flatText.length;
    totalCharsPass = actualTotalChars === challenge.totalChars;
    result.totalChars = {
      pass: totalCharsPass,
      actual: reveal ? actualTotalChars : 0,
      target: reveal ? challenge.totalChars : 0,
    };
  }

  // 6. Timing — use server wall-clock by default, fall back to client solvedAt
  const useServerTiming = options?.useServerTiming ?? true;
  const toleranceSeconds = options?.timingToleranceSeconds ?? 2;

  const elapsedMs = useServerTiming
    ? (Date.now() - challenge.createdAt)
    : (solution.solvedAt - challenge.createdAt);
  const elapsedSeconds = elapsedMs / 1000;
  const timingPass = elapsedSeconds >= 0 && elapsedSeconds <= (challenge.timeLimitSeconds + toleranceSeconds);
  result.timing = { pass: timingPass, elapsedSeconds };

  // Overall
  result.overallPass = asciiPass && lineCountPass && wordCountPass && charPositionPass && totalCharsPass && timingPass;
  result.verdict = result.overallPass ? 'VERIFIED_AI_AGENT' : 'CHALLENGE_FAILED';

  return result;
}

// ---------------------------------------------------------------------------
// Agent-side: solver type
// ---------------------------------------------------------------------------

/**
 * Callback that receives a captcha challenge and returns the solution text.
 *
 * Typically implemented by prompting an LLM to generate text that satisfies
 * all constraints (line count, ASCII sum, word count, etc.) in a single pass.
 */
export type CaptchaSolver = (challenge: CaptchaChallenge) => string | Promise<string>;

// ---------------------------------------------------------------------------
// Agent-side: sign-in captcha helper
// ---------------------------------------------------------------------------

/**
 * Detect and solve a captcha challenge from a nonce response.
 *
 * When a server's nonce endpoint returns `{ status: 'captcha_required' }`,
 * this helper calls the solver, packs the response, and returns a
 * `challengeResponse` string for the agent to include in the retry request.
 *
 * @param nonceResponse  The parsed JSON body from the nonce endpoint
 * @param solver         Callback that generates solution text from a challenge
 * @returns `{ solved: true, challengeResponse }` if captcha was solved,
 *          `{ solved: false }` if no captcha was required
 *
 * @example
 * ```typescript
 * import { solveCaptchaChallenge } from '@buildersgarden/siwa/captcha';
 *
 * const res = await fetch('/siwa/nonce', { method: 'POST', body: JSON.stringify(params) });
 * const nonceResult = await res.json();
 *
 * const captcha = await solveCaptchaChallenge(nonceResult, async (challenge) => {
 *   // LLM generates text satisfying all constraints
 *   return await generateText(challenge); // your LLM solver
 * });
 *
 * if (captcha.solved) {
 *   // Retry with challenge response
 *   const retry = await fetch('/siwa/nonce', {
 *     method: 'POST',
 *     body: JSON.stringify({ ...params, challengeResponse: captcha.challengeResponse }),
 *   });
 * }
 * ```
 */
export async function solveCaptchaChallenge(
  nonceResponse: { status: string; challenge?: CaptchaChallenge; challengeToken?: string },
  solver: CaptchaSolver,
): Promise<{ solved: true; challengeResponse: string } | { solved: false }> {
  if (
    nonceResponse.status !== 'captcha_required' ||
    !nonceResponse.challenge ||
    !nonceResponse.challengeToken
  ) {
    return { solved: false };
  }

  const text = await solver(nonceResponse.challenge);
  const challengeResponse = packCaptchaResponse(nonceResponse.challengeToken, text);
  return { solved: true, challengeResponse };
}

// ---------------------------------------------------------------------------
// Agent-side: pack / unpack response
// ---------------------------------------------------------------------------

/**
 * Package a captcha solution for submission (agent-side).
 *
 * @param challengeToken  The challenge token received from the server
 * @param text            The agent's solution text
 * @returns               A packed string to send in the challenge response header/field
 */
export function packCaptchaResponse(challengeToken: string, text: string): string {
  const solution: CaptchaSolution = {
    text,
    solvedAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify({ challengeToken, solution })).toString('base64url');
  return payload;
}

/**
 * Unpack a captcha response (server-side).
 *
 * @param packed  The base64url-encoded response from the agent
 * @returns       The challenge token and solution, or `null` if malformed
 */
export function unpackCaptchaResponse(
  packed: string,
): { challengeToken: string; solution: CaptchaSolution } | null {
  try {
    const decoded = JSON.parse(Buffer.from(packed, 'base64url').toString());
    if (!decoded.challengeToken || !decoded.solution?.text || typeof decoded.solution?.solvedAt !== 'number') {
      return null;
    }
    return { challengeToken: decoded.challengeToken, solution: decoded.solution };
  } catch {
    return null;
  }
}
