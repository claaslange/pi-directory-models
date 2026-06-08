# pi-directory-models

`pi-directory-models` is a pi extension that selects a model from the nearest ancestor `.pi/settings.json`.

It is meant for setups where different directory trees should automatically use different models or thinking levels.

## What it does

On session start, the extension walks up from the current working directory until it reaches your home directory or the filesystem root.

As soon as it finds an ancestor `.pi/settings.json` with one of these settings, it applies them:

- `defaultProvider`
- `defaultModel`
- `defaultThinkingLevel`

Missing values fall back to your global `~/.pi/agent/settings.json`.

## Example

Project root:

```json
{
  "defaultProvider": "github-copilot",
  "defaultModel": "gpt-5",
  "defaultThinkingLevel": "medium"
}
```

Put that in:

```text
/path/to/company-project/.pi/settings.json
```

Then every pi session started anywhere inside that project tree will switch to that model automatically.

## Requirements

- pi with hosted packages under `@earendil-works/*`
- extension peer deps: `@earendil-works/pi-coding-agent` and `@earendil-works/pi-agent-core`

This extension uses the current session lifecycle API (`session_start` with `event.reason`) and is meant for current hosted pi releases.

## Install

### npm

```bash
pi install npm:@claaslange/pi-directory-models
```

### Local path

```bash
pi install /absolute/path/to/pi-directory-models
```

### Git

```bash
pi install git:github.com/claaslange/pi-directory-models
```

## Package layout

- `extensions/index.ts` – extension entry point
- `package.json` – pi package manifest

## Development

```bash
npm install
npm run check
```

Useful scripts:

- `npm run typecheck`
- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run check`

## Publishing (maintainers)

This repo is set up to publish to npm via GitHub Actions on tags that match `vX.Y.Z`.

To publish:

1. Update `package.json` `version`.
2. Push the commit.
3. Push a matching tag, for example `git tag v0.1.0 && git push origin v0.1.0`.
4. Configure npm Trusted Publishing for `claaslange/pi-directory-models` and the publish workflow.

The published package name is `@claaslange/pi-directory-models`.

## Notes

- The nearest matching `.pi/settings.json` wins.
- If `defaultModel` is set without `defaultProvider`, the extension tries to resolve the model by ID from available models.
- If that model ID is ambiguous across providers, the extension shows a warning and asks you to set `defaultProvider` too.
