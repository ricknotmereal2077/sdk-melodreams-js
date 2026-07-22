# @heymelodreams/sdk

The JavaScript client for the Melodreams API.

No dependencies. Works on Node 18 and up, Bun, Deno and Cloudflare Workers.

```bash
npm install @heymelodreams/sdk
```

You need an active Melodreams subscription and an API token. Create one at
[developer.melodreams.com](https://developer.melodreams.com).

## Server side only

Do not put a token in a browser. Anyone can read it out of your bundle.

This client throws on startup if it detects a browser, and the API refuses
browser origins anyway. Call it from your server and send your frontend only
what it needs.

## Start here

```ts
import { Melodreams } from '@heymelodreams/sdk';

const melo = new Melodreams({ token: process.env.MELODREAMS_TOKEN! });

const me = await melo.me();
console.log(me.username);

const profile = await melo.profile('melodreams');
console.log(profile.display_name, profile.links.length);
```

Read the token from an environment variable or a secret manager. Never commit it.

## What you can call

| Method | Scope | Returns |
|---|---|---|
| `me()` | none | Who the token belongs to |
| `profile(username)` | `public:read` | Any public profile |
| `myProfile()` | `profile:read` | Your own profile and visibility settings |
| `myAnalytics()` | `analytics:read` | Your views and link clicks |
| `scopes()` | none | The scope list |
| `profiles(usernames)` | `public:read` | Several profiles at once |

Everything is read only. There are no write endpoints.

## Errors

```ts
import { Melodreams, MelodreamsError } from '@heymelodreams/sdk';

try {
  await melo.myAnalytics();
} catch (err) {
  if (err instanceof MelodreamsError) {
    if (err.needsPlan) {
      // 402, no active subscription
    } else if (err.isAuthProblem) {
      // 401, token revoked, expired or wrong
    }
    console.error(err.code, err.message, err.docs);
  }
}
```

Rate limits, server errors and network failures are retried for you with
backoff. A revoked token, a missing scope or a 404 is not, because retrying
those never helps.

## Limits

```ts
await melo.profile('melodreams');
console.log(melo.rateLimit);
```

Per token: 120 requests a minute, 50,000 a month, and 500 distinct profiles a
day.

That last one stops bulk scraping. Reading a profile you already read today
does not count again, so a widget showing the same handles all day is fine.
If you have a real reason to go past it, get in touch.

`quota_exceeded` and `distinct_profile_cap` are never retried, because waiting
will not help. `profiles()` also stops the rest of the batch as soon as it hits
the daily cap, instead of spending the rest of your quota on calls that will
all fail.

## Reading several profiles

```ts
const results = await melo.profiles(['melodreams', 'ada', 'grace'], { concurrency: 4 });

for (const { username, profile, error } of results) {
  if (profile) console.log(username, profile.display_name);
  else console.warn(username, error?.code);
}
```

This never throws. Every entry has either a profile or an error.

Private profiles come back as `profile_not_found`, the same as a handle that
does not exist. That is on purpose, so the API cannot be used to work out which
private accounts exist.

## Tokens are opaque

Token ids and secrets are base64url, so they contain underscores and hyphens.
Do not split a token or try to parse it. Pass it through as it is.

## Options

```ts
new Melodreams({
  token: process.env.MELODREAMS_TOKEN!,
  timeoutMs: 10_000,
  maxRetries: 2,
});
```

## Links

- Docs: [developer.melodreams.com/docs](https://developer.melodreams.com/docs)
- Tokens: [developer.melodreams.com](https://developer.melodreams.com)
- Issues: [github.com/ricknotmereal2077/sdk-melodreams-js/issues](https://github.com/ricknotmereal2077/sdk-melodreams-js/issues)

## License

MIT. Using the API needs an active subscription and is covered by our
[Terms of Service](https://melodreams.com/legal/terms-of-service).
