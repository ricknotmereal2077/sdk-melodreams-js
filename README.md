# @melodreams/sdk

Official TypeScript/JavaScript client for the [Melodreams Developer API](https://developer.melodreams.com/docs).

Zero dependencies. Node 18+ (or any runtime with global `fetch` — Bun, Deno, Cloudflare Workers).

```bash
npm install @melodreams/sdk
```

## Server-side only

An API token in a browser is a leaked token — anyone can read it out of your
bundle or devtools. This SDK **throws on construction** if it detects a browser
environment, and the API's CORS policy rejects browser origins anyway.

Call it from your server and expose only what your front end needs.

## Quick start

```ts
import { Melodreams } from '@melodreams/sdk';

const melo = new Melodreams({ token: process.env.MELODREAMS_TOKEN! });

const me = await melo.me();
console.log(me.username, me.limits.requests_per_month);

const profile = await melo.profile('ada');
console.log(profile.display_name, profile.links.length);
```

Never hard-code the token. Read it from an environment variable or a secret
manager.

## API

| Method | Scope required | Returns |
|---|---|---|
| `me()` | — | Identity of the token's owner |
| `profile(username)` | `public:read` | A public profile |
| `myProfile()` | `profile:read` | Your own profile, including visibility settings |
| `myAnalytics()` | `analytics:read` | Your view and click counters |
| `scopes()` | — | The scope catalogue |
| `profiles(usernames, opts?)` | `public:read` | Several profiles, bounded concurrency |

Everything is read-only. The API has no write endpoints.

## Errors

```ts
import { Melodreams, MelodreamsError } from '@melodreams/sdk';

try {
  await melo.myAnalytics();
} catch (err) {
  if (err instanceof MelodreamsError) {
    if (err.needsPlan) {
      // 402 — the account has no active subscription
    } else if (err.isAuthProblem) {
      // 401 — token revoked, expired, or wrong
    } else if (err.isRetryable) {
      // 429 / 5xx — already retried, still failing
    }
    console.error(err.code, err.message, err.docs);
  }
}
```

Transient failures (`429 rate_limited`, `5xx`, network errors) are retried
automatically with jittered exponential backoff. Definitive failures (`401`,
`402`, `403`, `404`) throw immediately without retrying — retrying a revoked
token is pointless.

## Rate limits

After any call, the limits from the last response are available:

```ts
await melo.profile('ada');
console.log(melo.rateLimit);
```

Two limits apply:

- **120 requests/minute** and **50,000 requests/month**, per token.
- **500 distinct profiles per UTC day**, per token, for `public:read`.

The second one is an anti-scraping control. Re-reading a profile you have
already fetched today does not count again, so a widget showing the same handles
all day is unaffected. Bulk harvesting the userbase is not a supported use case;
contact support if you have a legitimate high-volume need.

`quota_exceeded` and `distinct_profile_cap` are **never retried** — waiting
would not help. `profiles()` additionally abandons the rest of the batch the
moment it hits the distinct-profile cap, rather than burning your quota on
requests that will all fail.

## Batch reads

```ts
const results = await melo.profiles(['ada', 'grace', 'alan'], { concurrency: 4 });

for (const { username, profile, error } of results) {
  if (profile) console.log(username, profile.display_name);
  else console.warn(username, error?.code);
}
```

Never rejects — every entry carries either a `profile` or an `error`.

## Tokens are opaque

Token ids and secrets are base64url and may contain `_` and `-`. Do not parse or
split a token. Treat it as an opaque string.

## Options

```ts
new Melodreams({
  token: process.env.MELODREAMS_TOKEN!,
  timeoutMs: 10_000,
  maxRetries: 2,
  baseUrl: 'https://api-dev1.melodreams.com',
  fetch: customFetch,
});
```

## License

MIT
