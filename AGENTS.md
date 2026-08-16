# AGENTS.md

Shared backend services for higher-level components in **Principia**, a nanoservice
framework built primarily on Bun: environment variable schemas, error definitions,
Codogram (SMS/TOTP-style challenge codes), and Ata (JSON schema + validation).

## Runtime

- Requires Bun `>=1.4.0` or Node.js `>=26`, inherited from
  [@empyria/classification](https://github.com/imrefazekas/empyria-classification)'s use of
  native `Temporal`. See that repo's `AGENTS.md` — it's a **git dependency**, so this package
  only sees its pushed commits, not local working-tree changes.
- Plain ESM, no TypeScript, no build step.
- Relative imports **must** include explicit `.js` extensions (`from './Errors.js'`, not
  `'./Errors'`) — Bun tolerates missing ones, Node's ESM resolver doesn't.

## Validation: one library only

Schema validation runs on **`ata-validator`** exclusively (see [lib/Ata.js](./lib/Ata.js),
[lib/Defaulter.js](./lib/Defaulter.js)). `ajv` was deliberately removed — don't reintroduce it
or any second validator.

## Layout

- [index.js](./index.js) is the package entry point; it re-exports everything under `lib/`.
  When adding a new `lib/*.js` module, remember to add its `export * from './lib/X.js'` line
  here too — `Codogram.js` was missing from the barrel for a while and no one noticed.
- `lib/Errors.js` defines `BaseErrors`, the catalog of pre-built error factories other modules
  throw from (e.g. `throw new BaseErrors.EntityInvalid({...})`). Prefer adding to this catalog
  over throwing ad hoc errors.
- Tests live in `test/`, flat, one file per `lib/` module, using `bun:test`. Run via `bun run test`.

## Style

- Formatting is enforced by oxfmt ([.oxfmtrc.json](./.oxfmtrc.json)): tabs, single quotes, no
  semicolons, trailing commas. Run `bun run format:fix` before committing.
