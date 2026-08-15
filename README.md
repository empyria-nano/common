# @principia/common

Shared backend services for higher-level components in **Principia**, a nanoservice
framework built primarily on Bun: environment variable schemas, error definitions,
Codogram (SMS/TOTP-style challenge codes), and Ata (JSON schema building blocks and
validation).

## Requirements

- Bun `>=1.4.0` or Node.js `>=26`
- Plain ESM, no build step, no TypeScript

Both requirements come from [@principia/classification](https://github.com/imrefazekas/principia-classification),
which this package depends on and which uses the native `Temporal` global for all
date/time handling.

## Install

```bash
bun add @principia/common
```

## Usage

```js
import { createEnv, BaseErrors, generateCodogram, validate, string } from '@principia/common'

const envSchema = createEnv({ API_KEY: string() })

throw new BaseErrors.EntityInvalid({ type: 'User', id: 42 })

const pin = generateCodogram('PIN')
```

Everything is re-exported from the package root via [index.js](./index.js). Individual
modules under `lib/` can also be imported directly if you only need one:

```js
import { defineSchema } from '@principia/common/lib/Ata.js'
```

## Modules

| Module                                 | Purpose                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [index.js](./index.js)                 | Package entry point; re-exports every module below plus Moleculer meta helpers (`moleculerMeta`, `moleculerPrincipiaMeta`) and workflow ID helpers (`workflowName`, `workflowId`, `identifyWorkflow`).                                              |
| [lib/Errors.js](./lib/Errors.js)       | `PrincipiaError`, the `ErrorCreator` factory, and `BaseErrors` — Principia's catalog of pre-built, templated errors.                                                                                                                                |
| [lib/Env.js](./lib/Env.js)             | `createEnv`/`createConnectorEnv` — builds a service's environment-variable JSON schema from Principia-wide defaults.                                                                                                                                |
| [lib/Ata.js](./lib/Ata.js)             | JSON schema building blocks (`string`, `number`, `bool`, `enumType`, `email`, `password`, `ip4`, `ip6`, ...) and validation (`defineSchema`, `createValidator`, `validate`), built on [ata-validator](https://www.npmjs.com/package/ata-validator). |
| [lib/Codogram.js](./lib/Codogram.js)   | `generateCodogram` — one-time challenge codes (PIN, alphanumeric, alphabetic) for SMS/TOTP-style verification flows.                                                                                                                                |
| [lib/Defaulter.js](./lib/Defaulter.js) | `defaultsFromSchema` — builds a fully-populated default object for a JSON schema.                                                                                                                                                                   |

Every exported function is documented with JSDoc directly in its source file — hovering
a function in VSCode or Zed shows its parameters and return type without any extra
tooling, since both editors read JSDoc from plain `.js` files automatically.

Tests live under [test/](./test/), one file per module, separate from the `lib/` sources.

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
