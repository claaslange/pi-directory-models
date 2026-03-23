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

- pi / `@mariozechner/pi-coding-agent` `>= 0.62.0`

This extension does not use the APIs affected by the 0.62.0 breaking changes around `renderCall`/`renderResult` or `sourceInfo` provenance.

## Install

### Local path

```bash
pi install /absolute/path/to/pi-model-scope
```

### Git

```bash
pi install git:github.com/<you>/pi-model-scope
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

## Notes

- The nearest matching `.pi/settings.json` wins.
- If `defaultModel` is set without `defaultProvider`, the extension tries to resolve the model by ID from available models.
- If that model ID is ambiguous across providers, the extension shows a warning and asks you to set `defaultProvider` too.
