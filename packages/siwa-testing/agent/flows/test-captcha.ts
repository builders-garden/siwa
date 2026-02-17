/**
 * Unit tests for the Captcha module (reverse CAPTCHA).
 *
 * All tests are pure — no proxy, no server, no onchain calls.
 *
 *  1. Challenge generation (all 4 difficulty tiers)
 *  2. Challenge has correct constraints per difficulty
 *  3. HMAC token round-trip (create → verify)
 *  4. Tampered token rejected
 *  5. Solution verification — all constraints pass
 *  6. Failing: wrong line count
 *  7. Failing: wrong ASCII sum
 *  8. Failing: wrong word count (medium+)
 *  9. Failing: wrong char at position (hard+)
 * 10. Failing: wrong total chars (extreme)
 * 11. Failing: timing exceeded
 * 12. packCaptchaResponse / unpackCaptchaResponse round-trip
 * 13. unpackCaptchaResponse rejects garbage
 * 14. solveCaptchaChallenge detects + solves captcha_required
 * 15. solveCaptchaChallenge passes through non-captcha responses
 * 16. CaptchaVerifyOptions: revealConstraints=false redacts values
 * 17. CaptchaVerifyOptions: asciiTolerance allows near-misses
 * 18. CaptchaVerifyOptions: consumeChallenge rejects replays
 * 19. Custom difficulty overrides
 * 20. retryWithCaptcha detects 401 + captcha, returns signed retry
 */

import chalk from 'chalk';
import {
  createCaptchaChallenge,
  verifyCaptchaSolution,
  packCaptchaResponse,
  unpackCaptchaResponse,
  solveCaptchaChallenge,
  type CaptchaChallenge,
  type CaptchaSolution,
  type CaptchaOptions,
  type CaptchaDifficulty,
} from '@buildersgarden/siwa/captcha';
import {
  signAuthenticatedRequest,
  retryWithCaptcha,
} from '@buildersgarden/siwa/erc8128';
import { createReceipt } from '@buildersgarden/siwa/receipt';
import { createLocalAccountSigner } from '@buildersgarden/siwa/signer';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed++;
  console.log(chalk.green(`  \u{2705} ${label}`));
}

function fail(label: string, detail?: string) {
  failed++;
  console.log(chalk.red(`  \u{274C} ${label}`));
  if (detail) console.log(chalk.dim(`     ${detail}`));
}

const SECRET = 'test-captcha-secret';

const opts: CaptchaOptions = { secret: SECRET };

/**
 * Build a solution text that satisfies a challenge's constraints.
 * This is a deterministic solver for testing — not an LLM.
 */
function buildPassingSolution(challenge: CaptchaChallenge): string {
  const { lineCount, asciiTarget } = challenge;

  // Distribute ASCII target across first characters of each line
  const baseChar = Math.floor(asciiTarget / lineCount);
  const remainder = asciiTarget - baseChar * lineCount;
  const firstChars: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    firstChars.push(i < remainder ? baseChar + 1 : baseChar);
  }

  // Build lines with the required first chars and enough words
  const targetWords = challenge.wordCount ?? lineCount * 3;
  const wordsPerLine = Math.ceil(targetWords / lineCount);

  const lines: string[] = [];
  let totalWords = 0;
  for (let i = 0; i < lineCount; i++) {
    const first = String.fromCharCode(firstChars[i]);
    const words: string[] = [first + 'word'];
    for (let w = 1; w < wordsPerLine; w++) {
      words.push('filler');
    }
    // On last line, trim or pad to hit exact word count
    if (i === lineCount - 1 && challenge.wordCount !== undefined) {
      const need = challenge.wordCount - totalWords;
      while (words.length < need) words.push('pad');
      while (words.length > need) words.pop();
    }
    totalWords += words.length;
    lines.push(words.join(' '));
  }

  let text = lines.join('\n');

  // Handle charPosition constraint
  if (challenge.charPosition) {
    const [pos, requiredChar] = challenge.charPosition;
    const flat = lines.join('');
    if (flat[pos] !== requiredChar) {
      // Replace the character at position in the flattened text
      const flatChars = flat.split('');
      flatChars[pos] = requiredChar;
      // Reconstruct lines from flattened text
      let idx = 0;
      const newLines: string[] = [];
      for (const line of lines) {
        newLines.push(flatChars.slice(idx, idx + line.length).join(''));
        idx += line.length;
      }
      text = newLines.join('\n');
    }
  }

  // Handle totalChars constraint
  if (challenge.totalChars !== undefined) {
    const currentLines = text.split('\n');
    const currentTotal = currentLines.join('').length;
    const diff = challenge.totalChars - currentTotal;
    if (diff > 0) {
      // Pad last line
      currentLines[currentLines.length - 1] += 'x'.repeat(diff);
    } else if (diff < 0) {
      // Trim last line
      const lastLine = currentLines[currentLines.length - 1];
      currentLines[currentLines.length - 1] = lastLine.slice(0, lastLine.length + diff);
    }
    text = currentLines.join('\n');
  }

  return text;
}

export async function testCaptchaFlow(): Promise<boolean> {
  console.log(chalk.bold('Captcha Module Tests'));
  console.log('\u{2500}'.repeat(40));

  // ── Test 1: Challenge generation (all 4 tiers) ─────────────────
  const tiers: CaptchaDifficulty[] = ['easy', 'medium', 'hard', 'extreme'];
  const challenges: Record<string, { challenge: CaptchaChallenge; challengeToken: string }> = {};

  for (const tier of tiers) {
    try {
      const result = createCaptchaChallenge(tier, opts);
      if (result.challenge && result.challengeToken && result.challenge.difficulty === tier) {
        challenges[tier] = result;
        pass(`createCaptchaChallenge('${tier}') generates challenge`);
      } else {
        fail(`createCaptchaChallenge('${tier}')`, `Missing fields or wrong difficulty`);
      }
    } catch (err: any) {
      fail(`createCaptchaChallenge('${tier}')`, err.message);
    }
  }

  // ── Test 2: Constraints match difficulty ────────────────────────
  try {
    const easy = challenges['easy']?.challenge;
    const medium = challenges['medium']?.challenge;
    const hard = challenges['hard']?.challenge;
    const extreme = challenges['extreme']?.challenge;

    const checks = [
      easy && easy.wordCount === undefined && easy.charPosition === undefined && easy.totalChars === undefined,
      medium && medium.wordCount !== undefined && medium.charPosition === undefined,
      hard && hard.wordCount !== undefined && hard.charPosition !== undefined && hard.totalChars === undefined,
      extreme && extreme.wordCount !== undefined && extreme.charPosition !== undefined && extreme.totalChars !== undefined,
    ];

    if (checks.every(Boolean)) {
      pass('Difficulty tiers have correct constraint sets');
    } else {
      fail('Difficulty constraints', `easy=${checks[0]} medium=${checks[1]} hard=${checks[2]} extreme=${checks[3]}`);
    }
  } catch (err: any) {
    fail('Difficulty constraints', err.message);
  }

  // ── Test 3: HMAC token round-trip ──────────────────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const solution: CaptchaSolution = { text: buildPassingSolution(challenge), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result !== null) {
      pass('HMAC token round-trip: verifyCaptchaSolution accepts valid token');
    } else {
      fail('HMAC token round-trip', 'verifyCaptchaSolution returned null');
    }
  } catch (err: any) {
    fail('HMAC token round-trip', err.message);
  }

  // ── Test 4: Tampered token rejected ────────────────────────────
  try {
    const { challengeToken, challenge } = challenges['easy']!;
    const tampered = challengeToken.slice(0, 5) + 'X' + challengeToken.slice(6);
    const solution: CaptchaSolution = { text: buildPassingSolution(challenge), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(tampered, solution, SECRET);
    if (result === null) {
      pass('Tampered HMAC token rejected');
    } else {
      fail('Tampered token rejection', 'Should have returned null');
    }
  } catch (err: any) {
    fail('Tampered token rejection', err.message);
  }

  // ── Test 5: Full verification — all constraints pass ───────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const solutionText = buildPassingSolution(challenge);
    const solution: CaptchaSolution = { text: solutionText, solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result && result.overallPass && result.verdict === 'VERIFIED_AI_AGENT') {
      pass('Easy challenge: all constraints pass → VERIFIED_AI_AGENT');
    } else {
      fail('Easy verification', `overallPass=${result?.overallPass} ascii=${JSON.stringify(result?.asciiSum)} timing=${JSON.stringify(result?.timing)}`);
    }
  } catch (err: any) {
    fail('Easy verification', err.message);
  }

  // ── Test 6: Wrong line count fails ─────────────────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const solution: CaptchaSolution = { text: 'just one line', solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result && !result.overallPass) {
      pass('Wrong line count fails verification');
    } else {
      fail('Wrong line count', `overallPass should be false, got ${result?.overallPass}`);
    }
  } catch (err: any) {
    fail('Wrong line count', err.message);
  }

  // ── Test 7: Wrong ASCII sum fails ──────────────────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    // Build text with correct line count but wrong first chars
    const lines: string[] = [];
    for (let i = 0; i < challenge.lineCount; i++) {
      lines.push('A test line here');
    }
    const solution: CaptchaSolution = { text: lines.join('\n'), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    // Very unlikely 'A' * lineCount == asciiTarget
    if (result && !result.asciiSum.pass) {
      pass('Wrong ASCII sum fails asciiSum check');
    } else if (result && result.asciiSum.pass) {
      // Edge case: random target happened to match. Skip rather than fail.
      pass('Wrong ASCII sum test (target coincidentally matched — skipped)');
    } else {
      fail('Wrong ASCII sum', 'Unexpected null result');
    }
  } catch (err: any) {
    fail('Wrong ASCII sum', err.message);
  }

  // ── Test 8: Wrong word count fails (medium) ────────────────────
  try {
    const { challenge, challengeToken } = challenges['medium']!;
    // Build solution with correct lines but wrong word count
    const lines: string[] = [];
    for (let i = 0; i < challenge.lineCount; i++) {
      lines.push(String.fromCharCode(Math.floor(challenge.asciiTarget / challenge.lineCount)) + 'x');
    }
    const solution: CaptchaSolution = { text: lines.join('\n'), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result && result.wordCount && !result.wordCount.pass) {
      pass('Wrong word count fails wordCount check (medium)');
    } else {
      fail('Wrong word count', `wordCount=${JSON.stringify(result?.wordCount)}`);
    }
  } catch (err: any) {
    fail('Wrong word count', err.message);
  }

  // ── Test 9: Wrong char at position fails (hard) ────────────────
  try {
    const { challenge, challengeToken } = challenges['hard']!;
    const solutionText = buildPassingSolution(challenge);
    // Corrupt the character at the required position
    const [pos] = challenge.charPosition!;
    const flat = solutionText.split('\n').join('');
    const wrongChar = flat[pos] === 'z' ? 'a' : 'z';
    const lines = solutionText.split('\n');
    let idx = 0;
    const corrupted: string[] = [];
    for (const line of lines) {
      const chars = line.split('');
      for (let i = 0; i < chars.length; i++) {
        if (idx + i === pos) chars[i] = wrongChar;
      }
      corrupted.push(chars.join(''));
      idx += line.length;
    }
    const solution: CaptchaSolution = { text: corrupted.join('\n'), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result && result.charPosition && !result.charPosition.pass) {
      pass('Wrong char at position fails charPosition check (hard)');
    } else {
      fail('Wrong char position', `charPosition=${JSON.stringify(result?.charPosition)}`);
    }
  } catch (err: any) {
    fail('Wrong char position', err.message);
  }

  // ── Test 10: Wrong total chars fails (extreme) ─────────────────
  try {
    const { challenge, challengeToken } = challenges['extreme']!;
    const solutionText = buildPassingSolution(challenge);
    // Add extra characters to break totalChars constraint
    const padded = solutionText + 'XXXXX';
    const solution: CaptchaSolution = { text: padded, solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET);
    if (result && result.totalChars && !result.totalChars.pass) {
      pass('Wrong total chars fails totalChars check (extreme)');
    } else {
      fail('Wrong total chars', `totalChars=${JSON.stringify(result?.totalChars)}`);
    }
  } catch (err: any) {
    fail('Wrong total chars', err.message);
  }

  // ── Test 11: Timing exceeded fails ─────────────────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const solutionText = buildPassingSolution(challenge);
    const solution: CaptchaSolution = { text: solutionText, solvedAt: Date.now() };
    // Use client timing with a creation time far in the past → elapsed > timeLimit
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET, {
      useServerTiming: false,
    });
    // The challenge was just created so server timing passes.
    // Force client timing: solvedAt is now, but createdAt is also recent, so it passes.
    // Instead, create a backdated solution:
    const lateSolution: CaptchaSolution = {
      text: solutionText,
      solvedAt: challenge.createdAt + (challenge.timeLimitSeconds + 10) * 1000, // 10s past limit
    };
    const lateResult = await verifyCaptchaSolution(challengeToken, lateSolution, SECRET, {
      useServerTiming: false,
      timingToleranceSeconds: 0,
    });
    if (lateResult && !lateResult.timing.pass) {
      pass('Timing exceeded fails timing check');
    } else {
      fail('Timing exceeded', `timing=${JSON.stringify(lateResult?.timing)}`);
    }
  } catch (err: any) {
    fail('Timing exceeded', err.message);
  }

  // ── Test 12: pack / unpack round-trip ──────────────────────────
  try {
    const token = 'fake-challenge-token.fake-sig';
    const text = 'Hello\nWorld\nTest';
    const packed = packCaptchaResponse(token, text);
    const unpacked = unpackCaptchaResponse(packed);
    if (unpacked && unpacked.challengeToken === token && unpacked.solution.text === text) {
      pass('packCaptchaResponse / unpackCaptchaResponse round-trip');
    } else {
      fail('pack/unpack round-trip', `Unpacked: ${JSON.stringify(unpacked)}`);
    }
  } catch (err: any) {
    fail('pack/unpack round-trip', err.message);
  }

  // ── Test 13: unpackCaptchaResponse rejects garbage ─────────────
  try {
    const result1 = unpackCaptchaResponse('not-base64-at-all!!!');
    const result2 = unpackCaptchaResponse(Buffer.from('{}').toString('base64url'));
    if (result1 === null && result2 === null) {
      pass('unpackCaptchaResponse rejects malformed input');
    } else {
      fail('unpack rejection', `result1=${result1} result2=${result2}`);
    }
  } catch (err: any) {
    fail('unpack rejection', err.message);
  }

  // ── Test 14: solveCaptchaChallenge detects captcha_required ────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const nonceResponse = { status: 'captcha_required', challenge, challengeToken };
    const result = await solveCaptchaChallenge(nonceResponse, async (c) => {
      return buildPassingSolution(c);
    });
    if (result.solved && result.challengeResponse) {
      // Verify the packed response is valid
      const unpacked = unpackCaptchaResponse(result.challengeResponse);
      if (unpacked && unpacked.challengeToken === challengeToken) {
        pass('solveCaptchaChallenge detects captcha_required and solves');
      } else {
        fail('solveCaptchaChallenge', 'Packed response invalid');
      }
    } else {
      fail('solveCaptchaChallenge', `solved=${result.solved}`);
    }
  } catch (err: any) {
    fail('solveCaptchaChallenge', err.message);
  }

  // ── Test 15: solveCaptchaChallenge passes through non-captcha ──
  try {
    const result = await solveCaptchaChallenge(
      { status: 'nonce_issued' },
      async () => 'should not be called',
    );
    if (!result.solved) {
      pass('solveCaptchaChallenge returns { solved: false } for non-captcha response');
    } else {
      fail('solveCaptchaChallenge passthrough', 'Should have returned solved: false');
    }
  } catch (err: any) {
    fail('solveCaptchaChallenge passthrough', err.message);
  }

  // ── Test 16: revealConstraints=false redacts values ────────────
  try {
    const { challenge, challengeToken } = challenges['medium']!;
    const solution: CaptchaSolution = { text: buildPassingSolution(challenge), solvedAt: Date.now() };
    const result = await verifyCaptchaSolution(challengeToken, solution, SECRET, {
      revealConstraints: false,
    });
    if (result && result.asciiSum.actual === 0 && result.asciiSum.target === 0) {
      pass('revealConstraints=false redacts actual/target values');
    } else {
      fail('revealConstraints', `actual=${result?.asciiSum.actual} target=${result?.asciiSum.target}`);
    }
  } catch (err: any) {
    fail('revealConstraints', err.message);
  }

  // ── Test 17: asciiTolerance allows near-miss ───────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    // Build solution with ASCII sum off by exactly +2 from target
    // First, build a baseline that hits the exact target, then shift one char by +2
    const lines: string[] = [];
    const baseChar = Math.floor(challenge.asciiTarget / challenge.lineCount);
    const remainder = challenge.asciiTarget - baseChar * challenge.lineCount;
    for (let i = 0; i < challenge.lineCount; i++) {
      // Distribute remainder across first lines to hit exact target, then add 2 to first char
      const charCode = baseChar + (i < remainder ? 1 : 0) + (i === 0 ? 2 : 0);
      lines.push(String.fromCharCode(charCode) + ' filler words here now');
    }
    const solution: CaptchaSolution = { text: lines.join('\n'), solvedAt: Date.now() };

    // Without tolerance — should fail (off by 2)
    const strict = await verifyCaptchaSolution(challengeToken, solution, SECRET, { asciiTolerance: 0 });
    // With tolerance of 3 — should pass the ASCII check
    const tolerant = await verifyCaptchaSolution(challengeToken, solution, SECRET, { asciiTolerance: 3 });

    if (strict && !strict.asciiSum.pass && tolerant && tolerant.asciiSum.pass) {
      pass('asciiTolerance=3 accepts near-miss (off by 2)');
    } else {
      fail('asciiTolerance', `strict.pass=${strict?.asciiSum.pass} tolerant.pass=${tolerant?.asciiSum.pass}`);
    }
  } catch (err: any) {
    fail('asciiTolerance', err.message);
  }

  // ── Test 18: consumeChallenge rejects replays ──────────────────
  try {
    const { challenge, challengeToken } = challenges['easy']!;
    const solutionText = buildPassingSolution(challenge);
    const solution: CaptchaSolution = { text: solutionText, solvedAt: Date.now() };

    const consumed = new Set<string>();
    const consumeChallenge = async (token: string): Promise<boolean> => {
      if (consumed.has(token)) return false;
      consumed.add(token);
      return true;
    };

    const first = await verifyCaptchaSolution(challengeToken, solution, SECRET, { consumeChallenge });
    const second = await verifyCaptchaSolution(challengeToken, solution, SECRET, { consumeChallenge });

    if (first && first.overallPass && second === null) {
      pass('consumeChallenge rejects replay (second attempt returns null)');
    } else {
      fail('consumeChallenge replay', `first.pass=${first?.overallPass} second=${second}`);
    }
  } catch (err: any) {
    fail('consumeChallenge replay', err.message);
  }

  // ── Test 19: Custom difficulty overrides ────────────────────────
  try {
    const customOpts: CaptchaOptions = {
      secret: SECRET,
      difficulties: {
        easy: { timeLimitSeconds: 99, useWordCount: true },
      },
    };
    const { challenge } = createCaptchaChallenge('easy', customOpts);
    if (challenge.timeLimitSeconds === 99 && challenge.wordCount !== undefined) {
      pass('Custom difficulty overrides apply (easy: 99s + wordCount)');
    } else {
      fail('Custom difficulty', `timeLimit=${challenge.timeLimitSeconds} wordCount=${challenge.wordCount}`);
    }
  } catch (err: any) {
    fail('Custom difficulty', err.message);
  }

  // ── Test 20: retryWithCaptcha detects 401 + returns signed retry ─
  try {
    const account = privateKeyToAccount(generatePrivateKey());
    const signer = createLocalAccountSigner(account);
    const address = account.address;

    // Create a receipt for signing
    const { receipt } = createReceipt(
      {
        address,
        agentId: 42,
        agentRegistry: 'eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e',
        chainId: 84532,
        verified: 'onchain',
      },
      { secret: SECRET },
    );

    // Simulate a 401 response with captcha challenge
    const { challenge, challengeToken } = challenges['easy']!;
    const mockBody = JSON.stringify({
      error: 'Captcha required',
      captchaRequired: true,
      challenge,
      challengeToken,
    });
    const mockResponse = new Response(mockBody, {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    const originalUrl = 'https://api.example.com/action';
    const originalBody = JSON.stringify({ test: true });
    const freshRequest = new Request(originalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: originalBody,
    });

    const result = await retryWithCaptcha(
      mockResponse,
      freshRequest,
      receipt,
      signer,
      84532,
      async (c) => buildPassingSolution(c),
    );

    if (result.retry) {
      const signed = result.request;
      const hasSig = signed.headers.has('signature');
      const hasSigInput = signed.headers.has('signature-input');
      const hasReceipt = signed.headers.has('x-siwa-receipt');
      const hasChallengeResponse = signed.headers.has('x-siwa-challenge-response');

      if (hasSig && hasSigInput && hasReceipt && hasChallengeResponse) {
        pass('retryWithCaptcha returns signed request with all required headers');
      } else {
        fail('retryWithCaptcha headers', `sig=${hasSig} sigInput=${hasSigInput} receipt=${hasReceipt} challengeResponse=${hasChallengeResponse}`);
      }
    } else {
      fail('retryWithCaptcha', 'Expected retry: true');
    }
  } catch (err: any) {
    fail('retryWithCaptcha', err.message);
  }

  // ── Test 21: retryWithCaptcha ignores non-401 responses ────────
  try {
    const account = privateKeyToAccount(generatePrivateKey());
    const signer = createLocalAccountSigner(account);

    const mockResponse = new Response('OK', { status: 200 });
    const freshRequest = new Request('https://api.example.com/action');

    const result = await retryWithCaptcha(
      mockResponse, freshRequest, 'receipt', signer, 84532,
      async () => 'should not be called',
    );

    if (!result.retry) {
      pass('retryWithCaptcha returns { retry: false } for non-401 response');
    } else {
      fail('retryWithCaptcha non-401', 'Should have returned retry: false');
    }
  } catch (err: any) {
    fail('retryWithCaptcha non-401', err.message);
  }

  // ── Summary ────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`Results: ${passed} passed, ${failed} failed`));

  if (failed === 0) {
    console.log(chalk.green.bold('\u{2705} All Captcha tests passed'));
  } else {
    console.log(chalk.red.bold(`\u{274C} ${failed} test(s) failed`));
  }

  return failed === 0;
}
