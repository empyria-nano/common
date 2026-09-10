# @empyria/common

Shared backend services for higher-level components in **Empyria**, a nanoservice
framework built primarily on Bun: environment variable schemas, error definitions,
Codogram (SMS/TOTP-style challenge codes), and Ata (JSON schema building blocks and
validation).

## Requirements

- Bun `>=1.4.0` or Node.js `>=26`
- Plain ESM, no build step, no TypeScript

Both requirements come from [@empyria/classification](https://github.com/imrefazekas/empyria-classification),
which this package depends on and which uses the native `Temporal` global for all
date/time handling.

## Install

```bash
bun add @empyria/common
```

## Usage

```js
import { createEnv, BaseErrors, generateCodogram, validate, string } from '@empyria/common'

const envSchema = createEnv({ API_KEY: string() })

throw new BaseErrors.EntityInvalid({ type: 'User', id: 42 })

const pin = generateCodogram('PIN')
```

Everything is re-exported from the package root via [index.js](./index.js). Individual
modules under `lib/` can also be imported directly if you only need one:

```js
import { defineSchema } from '@empyria/common/lib/Ata.js'
```

## Modules

| Module                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [index.js](./index.js)                 | Package entry point; re-exports every module below plus Moleculer meta helpers (`moleculerMeta`, `moleculerEmpyriaMeta`) and workflow ID helpers (`workflowName`, `workflowId`, `identifyWorkflow`).                                                                                                                                                                                                                                              |
| [lib/Errors.js](./lib/Errors.js)       | `EmpyriaError`, the `ErrorCreator` factory, and `BaseErrors` — Empyria's catalog of pre-built, templated errors.                                                                                                                                                                                                                                                                                                                                  |
| [lib/Env.js](./lib/Env.js)             | `createEnv` — builds a service's environment-variable JSON schema from Empyria-wide defaults; pass `{ closed: true }` to reject undeclared vars and bind `{ coerceTypes, removeAdditional }` to the schema.                                                                                                                                                                                                                                       |
| [lib/Ata.js](./lib/Ata.js)             | JSON schema building blocks (`string`, `number`, `bool`, `enumType`, `email`, `password`, `ip4`, `ip6`, ...) and validation — throwing (`defineSchema`, `createValidator`, `validate`), transform-intent aliases (`parse`, `createParser`), or non-throwing/structured (`createChecker`, `checkSchema`, now returning the parsed `data`) — built on [ata-validator](https://www.npmjs.com/package/ata-validator). See _Validation options_ below. |
| [lib/Codogram.js](./lib/Codogram.js)   | `generateCodogram` — one-time challenge codes (PIN, alphanumeric, alphabetic) for SMS/TOTP-style verification flows.                                                                                                                                                                                                                                                                                                                              |
| [lib/Defaulter.js](./lib/Defaulter.js) | `defaultsFromSchema` — builds a fully-populated default object for a JSON schema.                                                                                                                                                                                                                                                                                                                                                                 |

Every exported function is documented with JSDoc directly in its source file — hovering
a function in VSCode or Zed shows its parameters and return type without any extra
tooling, since both editors read JSDoc from plain `.js` files automatically.

Tests live under [test/](./test/), one file per module, separate from the `lib/` sources.

## Validation options

`createValidator` / `validate` / `parse` / `createChecker` / `checkSchema` forward
[`ata-validator`'s options](https://www.npmjs.com/package/ata-validator) to the underlying
`Validator`. Options are resolved in three layers, **last wins**:

1. **library defaults** — `setAtaDefaults({ ... })`, called once at startup for a
   deployment-wide policy; `getAtaDefaults()` reads it back, `setAtaDefaults()` clears it.
2. **schema-bound** — `defineSchema(map, { validation: { ... } })` stores options on a
   non-enumerable key, so a schema carries its own parsing policy (`schemaOptions(schema)`
   reads it). The schema still serialises and compares as plain JSON Schema.
3. **per-call** — the `options` argument to any of the functions above.

`formats` is merged one level deep, with `EMPYRIA_FORMATS` always underneath.

| Option             | What it does (Empyria relevance)                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `coerceTypes`      | `"4040"` → `4040` before validation. The reason `env.js` files work — every `process.env` value is a string.                                  |
| `useDefaults`      | Fill missing props from their schema `default`. **On by default**; every `string()/number()/bool()/enumType()` emits one.                     |
| `removeAdditional` | Strip keys not covered by the schema. Only visible with `additionalProperties: false` (i.e. `defineSchema({ strict: true })`).                |
| `assertFormat`     | Whether a `format` mismatch is a hard error. On by default.                                                                                   |
| `abortEarly`       | Stop at the first error, skip enrichment. For hot verdict-only paths (pair with `createChecker`, not the throwing path).                      |
| `richErrors`       | Keep `ATA####` codes / doc URLs / hints that `renderPretty` & co. consume. On by default; leave it on.                                        |
| `verbose`          | Add `parentSchema` to each error (ajv's `verbose`).                                                                                           |
| `formats`          | Custom `format` checkers. `EMPYRIA_FORMATS` (`empyria-email`, `empyria-password`, `empyria-ipv4`, `empyria-ipv6`) is folded in automatically. |

**Return value / mutation.** `createValidator` & `validate` return `ata-validator`'s
`result.data` — the same object as the input unless `coerceTypes` / `removeAdditional` /
`useDefaults` applied. Those passes also **mutate the input object in place**, so hand them a
copy when the caller must keep its input pristine (as the `env.js` files do with
`{ ...process.env }`). `parse` / `createParser` are behavioural aliases for call sites whose
intent is to transform rather than merely assert. `createChecker` / `checkSchema` now also
return `data` (the parsed value on success, `undefined` on failure).

## Scripts

```bash
bun run format       # check formatting (oxfmt)
bun run format:fix   # apply formatting
bun run lint         # lint (oxlint)
bun run lint:fix     # lint and fix
bun run test         # run tests with coverage
```

## License

MIT © Imre Fazekas
