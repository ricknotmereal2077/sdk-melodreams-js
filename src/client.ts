import { MelodreamsError, MelodreamsRateLimitError } from './errors.js';
import type {
  ClientOptions, Identity, Profile, OwnProfile, Analytics, ScopeInfo, RateLimit,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api-dev1.melodreams.com';
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const SDK_VERSION = '0.1.0';

const TOKEN_SHAPE = /^mdr_(live|test)_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{43}$/;

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  docs?: string;
}

function parseRateLimit(headers: Headers): RateLimit {
  const limit = headers.get('X-RateLimit-Limit');
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');

  return {
    limit: limit === null ? null : Number(limit),
    remaining: remaining === null ? null : Number(remaining),
    resetsAt: reset === null ? null : new Date(reset),
  };
}

function jitteredBackoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 8000);
  return base * (0.5 + Math.random() * 0.5);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class Melodreams {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly userAgent: string;

  private lastRateLimit: RateLimit = { limit: null, remaining: null, resetsAt: null };

  constructor(options: ClientOptions) {
    if (!options?.token) {
      throw new Error(
        'Melodreams: a token is required. Read it from an environment variable, ' +
        'e.g. new Melodreams({ token: process.env.MELODREAMS_TOKEN })',
      );
    }

    if (!TOKEN_SHAPE.test(options.token)) {
      throw new Error(
        'Melodreams: that token is not the expected shape (mdr_live_<22>_<43>). ' +
        'Check for a truncated copy/paste or a stray whitespace character.',
      );
    }

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      throw new Error(
        'Melodreams: this client must not run in a browser. A token in a browser is a ' +
        'leaked token, because anyone can read it out of your bundle. Call the API from ' +
        'your server and send your frontend only what it needs.',
      );
    }

    const resolvedFetch = options.fetch ?? globalThis.fetch;
    if (typeof resolvedFetch !== 'function') {
      throw new Error(
        'Melodreams: no global fetch available. Use Node 18+, or pass one: ' +
        'new Melodreams({ token, fetch })',
      );
    }

    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = resolvedFetch;
    this.userAgent = options.userAgent ?? `melodreams-sdk-js/${SDK_VERSION}`;
  }

  get rateLimit(): RateLimit {
    return this.lastRateLimit;
  }

  private async request<T>(path: string): Promise<T> {
    let lastError: MelodreamsError | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await sleep(jitteredBackoff(attempt - 1));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/json',
            'User-Agent': this.userAgent,
          },
          signal: controller.signal,
        });
      } catch (cause) {
        lastError = new MelodreamsError({
          code: 'network_error',
          message:
            (cause as Error)?.name === 'AbortError'
              ? `Request to ${path} timed out after ${this.timeoutMs}ms.`
              : `Could not reach the Melodreams API: ${(cause as Error)?.message ?? cause}`,
          status: 0,
        });
        continue;
      } finally {
        clearTimeout(timer);
      }

      this.lastRateLimit = parseRateLimit(res.headers);

      let body: Envelope<T> | null = null;
      try {
        body = (await res.json()) as Envelope<T>;
      } catch {
        body = null;
      }

      if (res.ok && body?.ok) return body.data as T;

      const code = body?.error ?? 'internal_error';
      const message = body?.message ?? `Request failed with HTTP ${res.status}.`;

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        lastError = new MelodreamsRateLimitError({
          code,
          message,
          status: res.status,
          docs: body?.docs,
          retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined,
          resetsAt: this.lastRateLimit.resetsAt ?? undefined,
        });

        if (code === 'quota_exceeded' || code === 'distinct_profile_cap') throw lastError;
        continue;
      }

      const error = new MelodreamsError({
        code,
        message,
        status: res.status,
        docs: body?.docs,
      });

      if (!error.isRetryable) throw error;
      lastError = error;
    }

    throw lastError ?? new MelodreamsError({
      code: 'internal_error',
      message: 'Request failed and no error was captured.',
      status: 0,
    });
  }

  me(): Promise<Identity> {
    return this.request<Identity>('/v1/me');
  }

  profile(username: string): Promise<Profile> {
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
      throw new MelodreamsError({
        code: 'invalid_username',
        message: `"${username}" is not a valid Melodreams handle.`,
        status: 400,
      });
    }
    return this.request<Profile>(`/v1/profiles/${encodeURIComponent(username)}`);
  }

  myProfile(): Promise<OwnProfile> {
    return this.request<OwnProfile>('/v1/me/profile');
  }

  myAnalytics(): Promise<Analytics> {
    return this.request<Analytics>('/v1/me/analytics');
  }

  scopes(): Promise<{ scopes: ScopeInfo[] }> {
    return this.request<{ scopes: ScopeInfo[] }>('/v1/scopes');
  }

  async profiles(
    usernames: string[],
    options: { concurrency?: number } = {},
  ): Promise<Array<{ username: string; profile: Profile | null; error: MelodreamsError | null }>> {
    const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 10));
    const queue = [...usernames];
    const results: Array<{ username: string; profile: Profile | null; error: MelodreamsError | null }> = [];

    const worker = async () => {
      for (;;) {
        const username = queue.shift();
        if (username === undefined) return;
        try {
          results.push({ username, profile: await this.profile(username), error: null });
        } catch (err) {
          if (err instanceof MelodreamsRateLimitError && err.code === 'distinct_profile_cap') {
            queue.length = 0;
            results.push({ username, profile: null, error: err });
            return;
          }
          results.push({
            username,
            profile: null,
            error: err instanceof MelodreamsError ? err : new MelodreamsError({
              code: 'internal_error',
              message: String(err),
              status: 0,
            }),
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
  }
}
