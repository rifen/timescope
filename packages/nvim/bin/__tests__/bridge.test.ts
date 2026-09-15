import { spawn } from 'child_process';
import { join } from 'path';

interface BridgeTest {
  token: string;
  line: string;
  language?: string;
  expectedText?: string;
  expectedHint?: string;
  description: string;
}

interface BridgeResponse {
  text?: string;
  hint?: string;
  error?: string;
}

function runBridge(input: string): Promise<BridgeResponse | null> {
  return new Promise((resolve, reject) => {
    const bridge = spawn('node', ['timescope-bridge.js'], {
      cwd: join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    bridge.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    bridge.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    bridge.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Bridge exited with code ${code}: ${stderr}`));
      } else {
        try {
          const output = stdout.trim();
          if (!output) {
            resolve(null);
          } else {
            resolve(JSON.parse(output));
          }
        } catch (e) {
          reject(new Error(`Failed to parse output: ${stdout}`));
        }
      }
    });

    bridge.on('error', (err) => {
      reject(err);
    });

    bridge.stdin.write(input + '\n');
    bridge.stdin.end();
  });
}

const testCases: BridgeTest[] = [
  // === Variable assignments ===
  { token: '60 * 60', line: 'INTERVAL = 60 * 60', expectedText: '1h', expectedHint: 'INTERVAL', description: 'Variable assignment with expression' },
  { token: '900', line: 'TIMEOUT_SECONDS = 900', expectedText: '15m', expectedHint: 'TIMEOUT_SECONDS', description: 'Variable with keyword suffix' },
  { token: '2', line: 'RETRY_DELAY_S = 2', expectedText: '2s', expectedHint: 'RETRY_DELAY_S', description: '_S suffix' },
  { token: '500', line: 'MIN_TIMEOUT_MILLISECONDS = 500', expectedText: '500ms', expectedHint: 'MIN_TIMEOUT_MILLISECONDS', description: 'MILLISECONDS suffix' },

  // === Unit suffixes ===
  { token: '1500000', line: 'LONG_WAIT_MICROSECONDS = 1500000', expectedText: '1s 500ms', expectedHint: 'LONG_WAIT_MICROSECONDS', description: 'MICROSECONDS suffix' },
  { token: '750', line: 'VERY_SHORT_NANOSECONDS = 750', expectedText: '<1ms', expectedHint: 'VERY_SHORT_NANOSECONDS', description: 'NANOSECONDS suffix' },

  // === Keyword detection ===
  { token: '86400', line: 'SESSION_TTL = 86400', expectedText: '1d', expectedHint: 'SESSION_TTL', description: 'TTL keyword → seconds' },
  { token: '86400000', line: 'CACHE_EXPIRY = 86400000', expectedText: '2y 9mo', expectedHint: 'CACHE_EXPIRY', description: 'CACHE_EXPIRY keyword' },
  { token: '5000', line: 'RETRY_DELAY_MS = 5000', expectedText: '5s', expectedHint: 'RETRY_DELAY_MS', description: 'RETRY_DELAY_MS keyword' },

  // === Function call patterns (with language) ===
  { token: '3000', line: 'setTimeout(callback, 3000)', language: 'javascript', expectedText: '3s', expectedHint: 'setTimeout', description: 'setTimeout in JavaScript → milliseconds' },
  { token: '5000', line: 'setInterval(callback, 5000)', language: 'javascript', expectedText: '5s', expectedHint: 'setInterval', description: 'setInterval in JavaScript → milliseconds' },
  { token: '2000', line: 'requestAnimationFrame(fn, 2000)', language: 'javascript', expectedText: '2s', expectedHint: 'requestAnimationFrame', description: 'requestAnimationFrame in JavaScript → milliseconds' },
  { token: '2.5', line: 'time.sleep(2.5)', language: 'python', expectedText: '2s 500ms', expectedHint: 'time.sleep', description: 'time.sleep in Python → seconds' },
  { token: '1000000000', line: 'time.Sleep(1000000000)', language: 'go', expectedText: '1s', expectedHint: 'time.Sleep', description: 'time.Sleep in Go → nanoseconds' },
  { token: '10.0', line: 'timeout = 10.0', expectedText: '10s', expectedHint: 'timeout', description: 'Simple timeout variable' },

  // === HTTP client patterns ===
  { token: '30', line: 'client = httpx.Client(timeout=30)', expectedText: '30s', expectedHint: 'timeout', description: 'httpx.Client timeout kwarg' },
  { token: '3600', line: 'cache.set(key, value, ttl=3600)', expectedText: '1h', expectedHint: 'ttl', description: 'cache.set ttl kwarg' },
  { token: '60', line: 'retry_after = 60', expectedText: '60ms', expectedHint: 'retry', description: 'retry_after defaults to milliseconds' },

  // === Edge cases ===
  { token: '1', line: 'SMALL = 1', expectedText: '1s', description: 'Min boundary value' },
  { token: '8080', line: 'PORT = 8080', expectedText: '2h 14m', description: 'Port (not epoch)' },

  // === Ignored patterns (should return null) ===
  { token: '0xFF5733', line: 'HEX_COLOR = 0xFF5733', description: 'Hex color ignored' },
  { token: '1700000000', line: 'UNIX_TIMESTAMP = 1700000000', description: 'Unix epoch ignored (timestamp in line)' },
  { token: '-5000', line: 'NEGATIVE = -5000', description: 'Negative ignored' },
  { token: '0', line: 'ZERO = 0', description: 'Zero ignored' },
  { token: '31557600001', line: 'LARGE = 31557600001', description: 'Value above maxValue ignored' },
];

describe('TimeLens Neovim Bridge', () => {
  describe('Basic durations', () => {
    for (const tc of testCases) {
      it(tc.description, async () => {
        const response = await runBridge(JSON.stringify({ token: tc.token, line: tc.line, language: tc.language }));

        if (tc.expectedText === undefined && tc.expectedHint === undefined) {
          // Should be null (ignored)
          expect(response).toBeNull();
        } else {
          expect(response).not.toBeNull();
          if (response) {
            expect(response.text).toBe(tc.expectedText);
            if (tc.expectedHint) {
              expect(response.hint).toContain(tc.expectedHint);
            }
          }
        }
      }, 10000);
    }
  });

  describe('Input validation', () => {
    it('handles empty token', async () => {
      const response = await runBridge(JSON.stringify({ token: '', line: 'test' }));
      expect(response).toBeNull();
    });

    it('handles invalid JSON input', async () => {
      const bridge = spawn('node', ['timescope-bridge.js'], {
        cwd: join(__dirname, '..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      bridge.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      await new Promise<void>((resolve) => {
        bridge.on('close', () => {
          resolve();
        });
        bridge.stdin.write('invalid json\n');
        bridge.stdin.end();
      });

      expect(stderr).toContain('error');
    });

    it('handles missing token field', async () => {
      const response = await runBridge(JSON.stringify({ line: 'test' }));
      expect(response).toBeNull();
    });
  });

  describe('Format consistency', () => {
    it('returns compact format by default', async () => {
      const response = await runBridge(JSON.stringify({ token: '3600', line: 'timeout = 3600' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.text).toBe('1h');
      }
    });

    it('handles decimal values', async () => {
      const response = await runBridge(JSON.stringify({ token: '2.5', line: 'time.sleep(2.5)', language: 'python' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.text).toBe('2s 500ms');
      }
    });

    it('handles expression evaluation', async () => {
      const response = await runBridge(JSON.stringify({ token: '60 * 60 * 24', line: 'DAY = 60 * 60 * 24' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.text).toBe('1d');
      }
    });
  });

  describe('Hint generation', () => {
    it('includes keyword hint for timeout', async () => {
      const response = await runBridge(JSON.stringify({ token: '30', line: 'timeout = 30' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.hint).toContain('timeout');
      }
    });

    it('includes keyword hint for retry', async () => {
      const response = await runBridge(JSON.stringify({ token: '5000', line: 'retryDelay = 5000' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.hint).toContain('retry');
      }
    });

    it('includes keyword hint for ttl', async () => {
      const response = await runBridge(JSON.stringify({ token: '86400', line: 'ttl = 86400' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.hint).toContain('ttl');
      }
    });

    it('does not include hint when none detected', async () => {
      const response = await runBridge(JSON.stringify({ token: '500', line: 'value = 500' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.hint).toBeUndefined();
      }
    });

    it('includes language in hint for language-specific detection', async () => {
      const response = await runBridge(JSON.stringify({ token: '3000', line: 'setTimeout(fn, 3000)', language: 'javascript' }));
      expect(response).not.toBeNull();
      if (response) {
        expect(response.hint).toContain('javascript');
      }
    });
  });
});