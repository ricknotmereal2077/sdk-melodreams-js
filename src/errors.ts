export type MelodreamsErrorCode =
  | 'bad_request'
  | 'invalid_username'
  | 'invalid_scope'
  | 'missing_token'
  | 'malformed_token'
  | 'invalid_token'
  | 'token_revoked'
  | 'token_expired'
  | 'session_required'
  | 'plan_required'
  | 'insufficient_scope'
  | 'account_blocked'
  | 'not_found'
  | 'profile_not_found'
  | 'account_deleted'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'distinct_profile_cap'
  | 'api_unavailable'
  | 'scope_paused'
  | 'internal_error'
  | 'upstream_error'
  | 'network_error';

export class MelodreamsError extends Error {
  readonly code: MelodreamsErrorCode | string;
  readonly status: number;
  readonly docs?: string;
  readonly requestId?: string;

  constructor(opts: {
    code: MelodreamsErrorCode | string;
    message: string;
    status: number;
    docs?: string;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'MelodreamsError';
    this.code = opts.code;
    this.status = opts.status;
    this.docs = opts.docs;
    this.requestId = opts.requestId;
    Object.setPrototypeOf(this, MelodreamsError.prototype);
  }

  get isRetryable(): boolean {
    return (
      this.code === 'rate_limited' ||
      this.code === 'upstream_error' ||
      this.code === 'network_error' ||
      this.code === 'api_unavailable' ||
      this.code === 'scope_paused' ||
      this.status >= 500
    );
  }

  get isAuthProblem(): boolean {
    return this.status === 401;
  }

  get needsPlan(): boolean {
    return this.code === 'plan_required';
  }

  get isServicePaused(): boolean {
    return this.code === 'api_unavailable' || this.code === 'scope_paused';
  }
}

export class MelodreamsRateLimitError extends MelodreamsError {
  readonly retryAfterMs?: number;
  readonly resetsAt?: Date;

  constructor(opts: {
    code: MelodreamsErrorCode | string;
    message: string;
    status: number;
    docs?: string;
    requestId?: string;
    retryAfterMs?: number;
    resetsAt?: Date;
  }) {
    super(opts);
    this.name = 'MelodreamsRateLimitError';
    this.retryAfterMs = opts.retryAfterMs;
    this.resetsAt = opts.resetsAt;
    Object.setPrototypeOf(this, MelodreamsRateLimitError.prototype);
  }
}
