# Plugin Authoring Smoke Example

A Aidevelo plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into Aidevelo

```bash
pnpm aideveloai plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@aideveloai/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
