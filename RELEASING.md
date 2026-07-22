# Releasing

GitHub and npm are separate. Pushing to `main` updates what people read on
GitHub. It does not change what `npm install` gives them. Only a publish does
that, and npm versions are immutable, so you can never reuse a number.

## Cutting a release

```bash
npm version patch     # or minor, or major
git push --follow-tags
```

`npm version` bumps `package.json`, commits it, and creates a `vX.Y.Z` tag.
Pushing the tag triggers `.github/workflows/publish.yml`, which typechecks,
builds and publishes.

The workflow refuses to run if:

- the tag does not match the version in `package.json`
- that version already exists on the registry

Both checks exist because the failure they prevent is silent. Tagging `v0.2.0`
while `package.json` still says `0.1.0` would otherwise publish the wrong
thing under the right tag.

## Which number to bump

- `patch` for a bug fix that changes no shape
- `minor` for a new method or a new optional field
- `major` for anything that breaks a caller, including removing a field from a
  response type

Renaming a field in a response type is a breaking change even if the API kept
serving both, because TypeScript users compile against the old name.

## First time only

Publishing runs without a stored npm token. It uses trusted publishing, where
npm verifies the GitHub Actions run through OIDC. Set it up once:

1. npmjs.com, the `@heymelodreams/sdk` package, Settings
2. Trusted publisher, GitHub Actions
3. Repository `ricknotmereal2077/sdk-melodreams-js`, workflow `publish.yml`

Until that is configured the workflow will fail at the publish step. Nothing
else breaks, and you can still publish by hand from the repo root.

There is no token to store, rotate or leak. That is the point.

## Keeping the SDK honest

The types describe the API's response shape. When the API changes, the SDK
does not find out on its own. Before releasing, check that:

- every error code in the worker's `helpers/response.js` exists in `errors.ts`
- every field the API returns exists on the matching interface in `types.ts`

This has drifted before. The types once described four fields that did not
exist and omitted three that did.
