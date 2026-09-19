import { buildSymbolTable, scanCode } from '../index';

describe('scanCode', () => {
  it('scans multi-line code with duration constants', () => {
    const code = `
const TIMEOUT_SECONDS = 900;
const RETRY_DELAY_MS = 5000;
const CACHE_TTL = 60 * 60 * 24;
const NOT_A_DURATION = "hello world";
`;

    const result = scanCode(code, 'test.ts');
    expect(result.filePath).toBe('test.ts');
    expect(result.totalCount).toBe(3);

    const [timeout, retry, cache] = result.items;

    expect(timeout.token).toBe('900');
    expect(timeout.value).toBe(900);
    expect(timeout.unit).toBe('seconds');
    expect(timeout.formatted).toBe('15m');
    expect(timeout.identifier).toBe('TIMEOUT_SECONDS');

    expect(retry.token).toBe('5000');
    expect(retry.value).toBe(5000);
    expect(retry.unit).toBe('milliseconds');
    expect(retry.formatted).toBe('5s');
    expect(retry.identifier).toBe('RETRY_DELAY_MS');

    expect(cache.token).toBe('60 * 60 * 24');
    expect(cache.value).toBe(86400);
    expect(cache.unit).toBe('seconds');
    expect(cache.formatted).toBe('1d');
    expect(cache.identifier).toBe('CACHE_TTL');
  });

  it('scans yaml/config structures', () => {
    const yaml = `
server:
  port: 8080
  timeout: 30
  keepAliveTimeout: 60
  session_ttl: 3600
`;

    const result = scanCode(yaml, 'server.yaml');
    expect(result.totalCount).toBeGreaterThanOrEqual(3);
    const session = result.items.find(i => i.identifier === 'session_ttl');
    expect(session).toBeDefined();
    expect(session?.value).toBe(3600);
    expect(session?.formatted).toBe('1h');
  });
});

describe('buildSymbolTable (#26)', () => {
  it('resolves assignments that reference earlier variables', () => {
    const code = `
COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_SETTLE_SECONDS = 5
COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10
COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_ARM_ACTIVITY_SECONDS = int(COMMIT_TIMER_ARM_TIMEOUT_SECONDS) + 15
`;

    const symbols = buildSymbolTable(code);
    expect(symbols.get('COMMIT_TIMER_ARM_TIMEOUT_SECONDS')).toBe(15);
    expect(symbols.get('COMMIT_TIMER_ARM_ACTIVITY_SECONDS')).toBe(30);
  });

  it('joins multi-line parenthesized assignments', () => {
    const code = `
COMMIT_TIMER_SETTLE_SECONDS = 5
COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10
MIN_COMMIT_TIMER_SECONDS = (
    COMMIT_TIMER_SETTLE_SECONDS
    + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)
    + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS
)
`;

    expect(buildSymbolTable(code).get('MIN_COMMIT_TIMER_SECONDS')).toBe(30);
  });

  it('supports typed and keyword declarations', () => {
    const code = `
const TIMEOUT_SECONDS: number = 90;
let retry_delay_ms = 250;
var derived = TIMEOUT_SECONDS * 2;
`;

    const symbols = buildSymbolTable(code);
    expect(symbols.get('TIMEOUT_SECONDS')).toBe(90);
    expect(symbols.get('retry_delay_ms')).toBe(250);
    expect(symbols.get('derived')).toBe(180);
  });

  it('supports Lua local declarations', () => {
    const code = `
local retry_ms = 250
local cache_ttl = 3600
local derived = cache_ttl * 2
`;

    const symbols = buildSymbolTable(code);
    expect(symbols.get('retry_ms')).toBe(250);
    expect(symbols.get('cache_ttl')).toBe(3600);
    expect(symbols.get('derived')).toBe(7200);
  });

  it('strips Lua -- comments before resolving values', () => {
    const code = `
TIMEOUT_SECONDS = 900 -- 15m
local RETRY_DELAY_MS = 5000 -- 5s
`;

    const symbols = buildSymbolTable(code);
    expect(symbols.get('TIMEOUT_SECONDS')).toBe(900);
    expect(symbols.get('RETRY_DELAY_MS')).toBe(5000);
  });

  it('resolves timedelta constructor assignments', () => {
    const symbols = buildSymbolTable('DELAY = timedelta(minutes=5, seconds=30)\n');
    expect(symbols.get('DELAY')).toBe(330);
  });

  it('leaves cyclic and forward references unresolved', () => {
    const code = `
A = B + 1
B = A + 1
`;

    expect(buildSymbolTable(code).size).toBe(0);
  });

  it('does not treat Go-style short declarations as assignments', () => {
    expect(buildSymbolTable('x := 5\n').size).toBe(0);
  });
});

describe('scanCode - document symbol resolution (#26)', () => {
  const code = `
COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_SETTLE_SECONDS = 5
COMMIT_TIMER_CONFIRM_MARGIN_SECONDS = 10
COMMIT_TIMER_ARM_TIMEOUT_SECONDS = 15.0
COMMIT_TIMER_ARM_ACTIVITY_SECONDS = int(COMMIT_TIMER_ARM_TIMEOUT_SECONDS) + 15

MIN_COMMIT_TIMER_SECONDS = (
    COMMIT_TIMER_SETTLE_SECONDS
    + int(COMMIT_TIMER_CONFIRM_TIMEOUT_SECONDS)
    + COMMIT_TIMER_CONFIRM_MARGIN_SECONDS
)
`;

  it('reports a variable derived from an earlier variable once', () => {
    const result = scanCode(code, 'timers.py');
    const derived = result.items.find(
      item => item.identifier === 'COMMIT_TIMER_ARM_ACTIVITY_SECONDS',
    );
    expect(derived?.value).toBe(30);
    expect(derived?.unit).toBe('seconds');
    expect(derived?.formatted).toBe('30s');
  });

  it('reports a multi-line parenthesized assignment', () => {
    const result = scanCode(code, 'timers.py');
    const multiLine = result.items.find(
      item => item.identifier === 'MIN_COMMIT_TIMER_SECONDS',
    );
    expect(multiLine?.value).toBe(30);
    expect(multiLine?.unit).toBe('seconds');
    expect(multiLine?.formatted).toBe('30s');
  });
});
