import { Validator, renderPretty, renderCompact, renderJSON } from 'ata-validator'

import { cloneSelected, defined } from '@empyria/classification'
import { BaseErrors } from './Errors.js'

/** Regex pattern (string form) matching a single email address. */
export const P_EMAIL =
	"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$" // '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$'

/** Regex pattern (string form) requiring lower-case, upper-case, digit, and 8+ length. */
export const P_PASS = '(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})'

/** Regex pattern (string form) matching an IPv4 address. */
export const P_IPv4 =
	'(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}$'

const v6segment = '[a-fA-F\\d]{1,4}'
/** Regex pattern (string form) matching an IPv6 address (including IPv4-mapped forms). */
export const P_IPv6 = `
(?:
(?:${v6segment}:){7}(?:${v6segment}|:)|
(?:${v6segment}:){6}(?:${P_IPv4}|:${v6segment}|:)|
(?:${v6segment}:){5}(?::${P_IPv4}|(?::${v6segment}){1,2}|:)|
(?:${v6segment}:){4}(?:(?::${v6segment}){0,1}:${P_IPv4}|(?::${v6segment}){1,3}|:)|
(?:${v6segment}:){3}(?:(?::${v6segment}){0,2}:${P_IPv4}|(?::${v6segment}){1,4}|:)|
(?:${v6segment}:){2}(?:(?::${v6segment}){0,3}:${P_IPv4}|(?::${v6segment}){1,5}|:)|
(?:${v6segment}:){1}(?:(?::${v6segment}){0,4}:${P_IPv4}|(?::${v6segment}){1,6}|:)|
(?::(?:(?::${v6segment}){0,5}:${P_IPv4}|(?::${v6segment}){1,7}|:))
)(?:%[0-9a-zA-Z]{1,})?$`
	.replace(/\s*\/\/.*$/gm, '')
	.replace(/\n/g, '')
	.trim()

const RE_EMAIL = new RegExp(`^${P_EMAIL}`, 'i')
const RE_PASS = new RegExp(P_PASS)
const RE_IPv4 = new RegExp(`^${P_IPv4}`)
const RE_IPv6 = new RegExp(`^${P_IPv6}`)

/**
 * Empyria's custom `format` checkers, keyed by the `format` name a schema references.
 * Registered automatically on every validator this module builds (see `resolveOptions`), so
 * a schema carrying `{ type: 'string', format: 'empyria-email' }` — as produced by
 * {@link email}, {@link password}, {@link ip4}, {@link ip6} — is enforced with no per-call
 * wiring.
 *
 * The names are deliberately prefixed rather than reusing `email` / `ipv4` / `ipv6`:
 * `ata-validator`'s compiled path only lets a custom `formats` entry override a *built-in*
 * name at the schema root, not on a nested property, whereas an unknown name is honoured
 * everywhere. A caller's own `options.formats` entry for the same key still wins.
 *
 * A schema from {@link email} & co. is only enforced when validated through this module (or
 * through a validator the caller seeded with this map); a bare `new Validator(schema)` sees
 * these as unknown (ignored) formats.
 * @type {Record<string, (value: unknown) => boolean>}
 */
export const EMPYRIA_FORMATS = {
	'empyria-email': (s) => typeof s === 'string' && RE_EMAIL.test(s),
	'empyria-password': (s) => typeof s === 'string' && RE_PASS.test(s),
	'empyria-ipv4': (s) => typeof s === 'string' && RE_IPv4.test(s),
	'empyria-ipv6': (s) => typeof s === 'string' && RE_IPv6.test(s),
}

/** Non-enumerable key under which {@link defineSchema} stashes a schema's bound options. */
const SCHEMA_OPTIONS = Symbol('ataOptions')

/**
 * Known JSON Schema dialect URIs, keyed by short name. `defineSchema({ dialect })` accepts a
 * short name or a raw URI and stamps it as the schema's `$schema`. `ata-validator` reads
 * `$schema` to pick the dialect; `'v1'` (the forthcoming IETF standard) differs from
 * `'2020-12'` only in `$dynamicRef` scoping and unlocks `propertyDependencies` (see
 * {@link discriminated}).
 */
export const DIALECTS = {
	'2020-12': 'https://json-schema.org/draft/2020-12/schema',
	'draft-07': 'http://json-schema.org/draft-07/schema#',
	v1: 'https://json-schema.org/v1',
}

/** Process-wide default dialect for {@link defineSchema}; `null` = emit no `$schema`. */
let defaultDialect = null

/**
 * Sets the process-wide default dialect for {@link defineSchema} — the `$schema` it stamps
 * when a call passes no `dialect` of its own. Call once at startup to move a service to a
 * dialect (e.g. `'v1'`) without touching every schema.
 * @param {('2020-12'|'draft-07'|'v1'|string|null)} [dialect=null] - Short name, raw URI, or
 *   `null` to go back to emitting no `$schema`.
 * @returns {void}
 */
export function setDefaultDialect(dialect = null) {
	defaultDialect = dialect
}

/**
 * Returns the process-wide default dialect (see {@link setDefaultDialect}).
 * @returns {string|null}
 */
export function getDefaultDialect() {
	return defaultDialect
}

/** Process-wide default `ata-validator` options; the base layer for every call here. */
let libraryDefaults = {}

/**
 * Sets this module's process-wide default `ata-validator` options — the base layer every
 * {@link createValidator} / {@link validate} / {@link parse} / {@link createChecker} call in
 * this process starts from. Meant to be called once at startup to express a deployment-wide
 * policy (e.g. `{ coerceTypes: true }`). Individual calls stay free to override any key, and
 * a schema built by {@link defineSchema} with a `validation` bag overrides these too.
 *
 * Merge order, lowest to highest precedence: **library defaults → schema-bound → per-call**.
 * `formats` is merged one level deep, with {@link EMPYRIA_FORMATS} always underneath.
 * @param {import('ata-validator').ValidatorOptions} [options={}] - Replaces the current
 *   defaults wholesale. Pass `{}` (or call with no argument) to clear them.
 * @returns {void}
 */
export function setAtaDefaults(options = {}) {
	libraryDefaults = { ...options }
}

/**
 * Returns a shallow copy of the current process-wide default options (see {@link setAtaDefaults}).
 * @returns {import('ata-validator').ValidatorOptions}
 */
export function getAtaDefaults() {
	return { ...libraryDefaults }
}

/**
 * Returns a shallow copy of the `ata-validator` options bound to `schema` by
 * {@link defineSchema}'s `validation` option, or `{}` if none were bound.
 * @param {Object} schema
 * @returns {import('ata-validator').ValidatorOptions}
 */
export function schemaOptions(schema) {
	const bound = schema?.[SCHEMA_OPTIONS]
	return bound ? { ...bound } : {}
}

/**
 * Merges the three option layers for a single call and folds in {@link EMPYRIA_FORMATS}.
 * @param {Object} schema - Schema being validated (may carry bound options).
 * @param {import('ata-validator').ValidatorOptions} [perCall] - Options passed to this call.
 * @returns {import('ata-validator').ValidatorOptions}
 */
function resolveOptions(schema, perCall) {
	const bound = schema?.[SCHEMA_OPTIONS] ?? {}
	return {
		...libraryDefaults,
		...bound,
		...perCall,
		formats: {
			...EMPYRIA_FORMATS,
			...libraryDefaults.formats,
			...bound.formats,
			...(perCall && perCall.formats),
		},
	}
}

/**
 * Builds a function that clones only the keys declared on a schema's `properties`.
 * @param {Object} schema - JSON schema with a `properties` map.
 * @returns {(obj: Object) => Object} Function that shallow-clones an object down to those keys.
 */
export function cloneBySchema(schema) {
	const keys = Object.keys(schema.properties)
	return (obj) => cloneSelected(obj, keys)
}

/**
 * Builds a JSON schema object from a flat map of property schemas.
 * @param {Object} schemaDef - Map of property name to its JSON schema.
 * @param {Object} [options={}]
 * @param {(boolean|'unevaluated')} [options.strict] - `true` disallows properties not listed
 *   in `schemaDef` (`additionalProperties: false`); combine with
 *   `validation: { removeAdditional: true }` to *strip* unknown keys instead of rejecting
 *   them. `'unevaluated'` sets `unevaluatedProperties: false` and leaves `additionalProperties`
 *   open — the composable form of strict, for a schema meant to be `allOf`-combined. Ignored
 *   when `options.additionalProperties` is given.
 * @param {boolean|Object} [options.additionalProperties] - Explicit `additionalProperties`
 *   value (a boolean, or a sub-schema for the extra keys). Overrides `options.strict`.
 * @param {('2020-12'|'draft-07'|'v1'|string)} [options.dialect] - Stamp this dialect as the
 *   schema's `$schema` (short name from {@link DIALECTS}, or a raw URI). Defaults to
 *   {@link getDefaultDialect}; when both are unset no `$schema` is emitted.
 * @param {boolean} [options.optional] - If true, a property whose own schema carries
 *   `optional: true` is excluded from `required` (that marker is then stripped from the
 *   property itself — never leaked into the resulting schema, since it isn't a real JSON
 *   Schema keyword). Off by default: every declared property is required, exactly as before —
 *   a caller that never sets `optional: true` on any property sees no difference either way.
 * @param {import('ata-validator').ValidatorOptions} [options.validation] - `ata-validator`
 *   options bound to the returned schema: every {@link createValidator} / {@link validate} /
 *   {@link parse} / {@link createChecker} call for it starts from these (below per-call
 *   options, above {@link setAtaDefaults}). Stored on a non-enumerable key, so the schema
 *   still serialises and compares as a plain JSON Schema.
 * @returns {Object} A JSON schema: `{ type: 'object', properties, required, additionalProperties }`.
 */
export function defineSchema(schemaDef, options = {}) {
	const properties = {}
	const required = []

	for (const [key, propertySchema] of Object.entries(schemaDef)) {
		if (options.optional && propertySchema?.optional) {
			const { optional, ...rest } = propertySchema
			properties[key] = rest
		} else {
			properties[key] = propertySchema
			required.push(key)
		}
	}
	const unevaluated = options.strict === 'unevaluated'
	const schema = {
		type: 'object',
		properties,
		required,
		additionalProperties: defined(options.additionalProperties)
			? options.additionalProperties
			: !options.strict || unevaluated,
	}
	if (unevaluated) schema.unevaluatedProperties = false

	const dialect = options.dialect ?? defaultDialect
	if (dialect) schema.$schema = DIALECTS[dialect] ?? dialect

	if (options.validation) {
		Object.defineProperty(schema, SCHEMA_OPTIONS, {
			value: { ...options.validation },
			enumerable: false,
		})
	}

	return schema
}

/**
 * Builds a validating function for a JSON schema.
 *
 * Options are resolved in three layers — {@link setAtaDefaults} → the schema's bound
 * `validation` (see {@link defineSchema}) → the `options` argument here — with the last
 * winning, and {@link EMPYRIA_FORMATS} always folded into `formats`.
 *
 * The returned function returns the schema-shaped value: `ata-validator`'s `result.data`,
 * which is `data` itself unless `coerceTypes` / `removeAdditional` / `useDefaults` (the last
 * on by default) applied. Those passes also mutate `data` in place, so pass a copy when the
 * caller must keep its input pristine (see `createEnv` / the `env.js` files).
 * @param {Object} schema - JSON schema to validate against.
 * @param {import('ata-validator').ValidatorOptions} [options] - Per-call options (see above):
 *   `coerceTypes`, `removeAdditional`, `useDefaults`, `assertFormat`, `abortEarly`,
 *   `richErrors`, `verbose`, `formats`, ... Left unset, validation is strict: a schema
 *   expecting `type: 'number'` rejects `"32"`.
 * @returns {(data: *) => *} Function that returns the (possibly coerced/defaulted) value.
 * @throws {EmpyriaError} `BaseErrors.ValidationError` (with a pretty-rendered violation list
 *   in its `validation` param) if `data` doesn't satisfy the schema.
 */
export function createValidator(schema, options) {
	const v = new Validator(schema, resolveOptions(schema, options))

	return (data) => {
		const result = v.validate(data)
		if (!result.valid) {
			throw new BaseErrors.ValidationError({
				name: schema.title || schema.name || '',
				value: '',
				validation: renderPretty(result.errors),
			})
		}
		return result.data ?? data
	}
}

/**
 * Validates `input` against `schema` in one call.
 * @param {Object} schema - JSON schema to validate against.
 * @param {*} input - Value to validate.
 * @param {import('ata-validator').ValidatorOptions} [options] - Forwarded to {@link createValidator}.
 * @returns {*} `input` — coerced/defaulted/stripped per the resolved options — if valid.
 * @throws {EmpyriaError} `BaseErrors.ValidationError` if `input` doesn't satisfy the schema.
 */
export function validate(schema, input, options) {
	const validateInput = createValidator(schema, options)
	const validatedInput = validateInput(input)

	return validatedInput
}

/**
 * {@link createValidator} under an intent-revealing name, for call sites whose purpose is to
 * *transform* input — coerce string-typed values, strip unknown keys, apply schema defaults —
 * rather than merely assert its shape. Behaviour is identical; the name documents that the
 * returned value is expected to differ from the input.
 * @param {Object} schema - JSON schema to validate/parse against.
 * @param {import('ata-validator').ValidatorOptions} [options] - Typically `{ coerceTypes: true }`
 *   and/or `{ removeAdditional: true }` (with a closed schema).
 * @returns {(data: *) => *} Function returning the parsed value.
 * @throws {EmpyriaError} `BaseErrors.ValidationError` on invalid input.
 */
export function createParser(schema, options) {
	return createValidator(schema, options)
}

/**
 * {@link validate} under an intent-revealing name — see {@link createParser}.
 * @param {Object} schema - JSON schema to parse against.
 * @param {*} input - Value to parse.
 * @param {import('ata-validator').ValidatorOptions} [options] - Forwarded to {@link createParser}.
 * @returns {*} The parsed (coerced/defaulted/stripped) value, if valid.
 * @throws {EmpyriaError} `BaseErrors.ValidationError` on invalid input.
 */
export function parse(schema, input, options) {
	return createParser(schema, options)(input)
}

/**
 * Builds a non-throwing checking function for a JSON schema — the structured-result
 * counterpart to {@link createValidator}. Use it when a caller needs `ata-validator`'s own
 * error list (to build its own error type, count violations, or render them itself with
 * {@link renderCompact} / {@link renderJSON}) rather than a `BaseErrors.ValidationError`
 * carrying a pre-rendered string, or when it wants the parsed value without a `try`/`catch`.
 * @param {Object} schema - JSON schema to validate against.
 * @param {import('ata-validator').ValidatorOptions} [options] - Resolved the same way as for
 *   {@link createValidator} (see its docs for the layers and the common flags).
 * @returns {(data: *) => { valid: boolean, data: *, errors: Array<Object> }} Function that
 *   returns the verdict, the parsed value (`data` when valid — coerced/defaulted/stripped per
 *   the resolved options; `undefined` when invalid), and, when invalid, `ata-validator`'s raw
 *   error objects (empty array when valid). Never throws on a validation failure.
 */
export function createChecker(schema, options) {
	const v = new Validator(schema, resolveOptions(schema, options))

	return (data) => {
		const result = v.validate(data)
		return {
			valid: result.valid,
			data: result.valid ? (result.data ?? data) : undefined,
			errors: result.valid ? [] : result.errors,
		}
	}
}

/**
 * Checks `input` against `schema` in one call, without throwing.
 * @param {Object} schema - JSON schema to validate against.
 * @param {*} input - Value to validate.
 * @param {import('ata-validator').ValidatorOptions} [options] - Forwarded to {@link createChecker}.
 * @returns {{ valid: boolean, data: *, errors: Array<Object> }} The verdict, the parsed value
 *   (when valid), plus `ata-validator`'s raw error objects when invalid.
 */
export function checkSchema(schema, input, options) {
	return createChecker(schema, options)(input)
}

/**
 * Re-exported from `ata-validator`:
 * - `renderCompact(errors)` renders a validation error list compactly (one line each).
 * - `renderJSON(errors)` renders a validation error list as JSON.
 */
export { renderCompact, renderJSON }

/**
 * JSON schema for a boolean property.
 * @param {boolean} [defaultValue] - Default value, if any.
 * @returns {Object} `{ type: 'boolean', default? }`.
 */
export function bool(defaultValue) {
	const schema = {
		type: 'boolean',
	}
	if (defined(defaultValue)) schema.default = Boolean(defaultValue)
	return schema
}

/**
 * JSON schema for a string property.
 * @param {string} [defaultValue] - Default value, if any.
 * @param {number|Object} [opts] - A bare number is shorthand for `{ minLength }` (kept for
 *   back-compat). As an object:
 * @param {number} [opts.minLength] - Minimum length (`0` is honoured, unlike the old
 *   number-shorthand which dropped non-positive values).
 * @param {number} [opts.maxLength] - Maximum length.
 * @param {string} [opts.pattern] - `pattern` regex (string form, unanchored per JSON Schema).
 * @param {string} [opts.format] - `format` name (e.g. an {@link EMPYRIA_FORMATS} key or a
 *   built-in like `'uri'`; see {@link isoDateTime} & co. for ready-made wrappers).
 * @param {string} [opts.description]
 * @returns {Object} `{ type: 'string', default?, minLength?, maxLength?, pattern?, format?, description? }`.
 */
export function string(defaultValue, opts) {
	const o = typeof opts === 'number' ? { minLength: opts } : (opts ?? {})
	const schema = { type: 'string' }
	if (defined(defaultValue)) schema.default = `${defaultValue}`
	if (defined(o.minLength) && o.minLength >= 0) schema.minLength = o.minLength
	if (defined(o.maxLength)) schema.maxLength = o.maxLength
	if (defined(o.pattern)) schema.pattern = o.pattern
	if (defined(o.format)) schema.format = o.format
	if (defined(o.description)) schema.description = o.description
	return schema
}

/**
 * JSON schema for an enumerated property.
 * @param {Array} list - Allowed values.
 * @param {*} [defaultValue] - Default value, if any.
 * @param {Object} [opts]
 * @param {string} [opts.type] - Optional `type` alongside `enum` (helps tooling / type
 *   inference; validation is unchanged since `enum` already pins the values).
 * @param {string} [opts.description]
 * @returns {Object} `{ enum: list, type?, default?, description? }`.
 */
export function enumType(list, defaultValue, opts = {}) {
	const schema = {
		enum: list,
	}
	if (defined(opts.type)) schema.type = opts.type
	if (defined(defaultValue)) schema.default = defaultValue
	if (defined(opts.description)) schema.description = opts.description
	return schema
}

/**
 * JSON schema for a log-level environment variable, defaulting to `'info'`.
 * @returns {Object} Enum schema over the standard Pino/Moleculer log levels.
 */
export function logLevel() {
	return enumType(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], 'info')
}

/**
 * JSON schema for a temp-folder path, defaulting to `'./tmp'`.
 * @returns {Object} String schema.
 */
export function tmpFile() {
	return string('./tmp')
}

/**
 * JSON schema for a log-file path, defaulting to `'./tmp/moleculer.log'`.
 * @returns {Object} String schema.
 */
export function logFile() {
	return string('./tmp/moleculer.log')
}

/**
 * JSON schema for a `NODE_ENV`-style environment variable, defaulting to `'local'`.
 * Includes `'test'` because `bun test` (and most JS test runners) set `NODE_ENV=test`
 * automatically — omitting it means any app validating `process.env` at import time
 * (see `createEnv`) can never run its own test suite.
 * @returns {Object} Enum schema over `'production' | 'development' | 'local' | 'test'`.
 */
export function nodeEnv() {
	return enumType(['production', 'development', 'local', 'test'], 'local')
}

/**
 * @param {'number'|'integer'} type
 * @param {number} [defaultValue]
 * @param {Object} [opts] - `min`/`max` (inclusive → `minimum`/`maximum`),
 *   `exclusiveMin`/`exclusiveMax`, `multipleOf`, `description`.
 * @returns {Object}
 */
function numeric(type, defaultValue, opts = {}) {
	const schema = { type }
	if (defined(defaultValue)) schema.default = Number(defaultValue)
	if (defined(opts.min)) schema.minimum = opts.min
	if (defined(opts.max)) schema.maximum = opts.max
	if (defined(opts.exclusiveMin)) schema.exclusiveMinimum = opts.exclusiveMin
	if (defined(opts.exclusiveMax)) schema.exclusiveMaximum = opts.exclusiveMax
	if (defined(opts.multipleOf)) schema.multipleOf = opts.multipleOf
	if (defined(opts.description)) schema.description = opts.description
	return schema
}

/**
 * JSON schema for a numeric property (`type: 'number'` — accepts integers and reals).
 * @param {number} [defaultValue] - Default value, if any.
 * @param {Object} [opts] - `min`, `max`, `exclusiveMin`, `exclusiveMax`, `multipleOf`,
 *   `description` (see {@link numeric}).
 * @returns {Object} `{ type: 'number', default?, minimum?, maximum?, ... }`.
 */
export function number(defaultValue, opts) {
	return numeric('number', defaultValue, opts)
}

/**
 * JSON schema for an integer property (`type: 'integer'` — rejects `3.5`, and with
 * `coerceTypes` rejects `"3.5"`). Prefer this over {@link number} for ports, counts, lengths.
 * @param {number} [defaultValue] - Default value, if any.
 * @param {Object} [opts] - Same as {@link number}.
 * @returns {Object} `{ type: 'integer', default?, minimum?, maximum?, ... }`.
 */
export function integer(defaultValue, opts) {
	return numeric('integer', defaultValue, opts)
}

/**
 * JSON schema for a constant value (`const`). Useful as a discriminator tag or a pinned
 * config value.
 * @param {*} value - The only accepted value (compared structurally).
 * @param {Object} [opts] - `description`.
 * @returns {Object} `{ const: value, description? }`.
 */
export function constant(value, opts = {}) {
	const schema = { const: value }
	if (defined(opts.description)) schema.description = opts.description
	return schema
}

/**
 * Wraps a schema so `null` is also accepted. A schema with a single string `type` gets
 * `type: [t, 'null']`; anything else (an `enum`, a `$ref`, a composed schema) is wrapped as
 * `{ anyOf: [schema, { type: 'null' }] }`.
 * @param {Object} schema - The schema to make nullable.
 * @returns {Object}
 */
export function nullable(schema) {
	if (schema && typeof schema.type === 'string') {
		return { ...schema, type: [schema.type, 'null'] }
	}
	return { anyOf: [schema, { type: 'null' }] }
}

/**
 * JSON schema for an array property.
 * @param {Object} [items] - Schema every element must satisfy. Omit for "any element".
 * @param {Object} [opts] - `minItems`, `maxItems`, `uniqueItems` (boolean), `default`,
 *   `description`.
 * @returns {Object} `{ type: 'array', items?, minItems?, maxItems?, uniqueItems?, default?, description? }`.
 */
export function array(items, opts = {}) {
	const schema = { type: 'array' }
	if (defined(items)) schema.items = items
	if (defined(opts.minItems)) schema.minItems = opts.minItems
	if (defined(opts.maxItems)) schema.maxItems = opts.maxItems
	if (opts.uniqueItems) schema.uniqueItems = true
	if (defined(opts.default)) schema.default = opts.default
	if (defined(opts.description)) schema.description = opts.description
	return schema
}

/**
 * JSON Schema v1 `propertyDependencies`: an object that takes a different shape depending on
 * the value of a discriminator property. Replaces the `oneOf` + `if`/`then`/`const` pattern.
 * Validates on every `ata-validator` engine (supported since 1.5.0); pair with
 * `defineSchema`'s `dialect: 'v1'` — or `setDefaultDialect('v1')` — for a spec-legitimate
 * `$schema`.
 * The result is open (`additionalProperties` unset): `additionalProperties: false` cannot be
 * used alongside `propertyDependencies` — it does not see through the branches and would
 * reject every branch key. For a closed union, give each branch schema its own
 * `unevaluatedProperties: false` and add one at this level too.
 * @param {string} property - The discriminator property name.
 * @param {Record<string, Object>} mapping - Discriminator value → the schema the rest of the
 *   object must then satisfy.
 * @param {Object} [opts]
 * @param {string} [opts.description]
 * @returns {Object} `{ type: 'object', properties: { [property]: { enum } }, required, propertyDependencies }`.
 */
export function discriminated(property, mapping, opts = {}) {
	const schema = {
		type: 'object',
		properties: { [property]: { enum: Object.keys(mapping) } },
		required: [property],
		propertyDependencies: { [property]: mapping },
	}
	if (defined(opts.description)) schema.description = opts.description
	return schema
}

const stringFormat = (format, description) => ({ type: 'string', format, description })

/** JSON schema for an RFC 3339 date-time string (`format: 'date-time'`). */
export function isoDateTime() {
	return stringFormat('date-time', 'ISO 8601 / RFC 3339 date-time')
}

/** JSON schema for an RFC 3339 full-date string (`format: 'date'`). */
export function isoDate() {
	return stringFormat('date', 'ISO 8601 / RFC 3339 date')
}

/** JSON schema for an RFC 3339 full-time string (`format: 'time'`). */
export function isoTime() {
	return stringFormat('time', 'ISO 8601 / RFC 3339 time')
}

/** JSON schema for an ISO 8601 duration string (`format: 'duration'`, e.g. `P1DT2H`). */
export function duration() {
	return stringFormat('duration', 'ISO 8601 duration')
}

/** JSON schema for a URI string (`format: 'uri'`). */
export function uri() {
	return stringFormat('uri', 'URI')
}

/** JSON schema for a UUID string (`format: 'uuid'`). */
export function uuid() {
	return stringFormat('uuid', 'UUID')
}

/**
 * JSON schema for an email-address string, checked against the `email` format
 * ({@link EMPYRIA_FORMATS}, which mirrors {@link P_EMAIL}).
 * @returns {Object} String schema with `format` and `description` set.
 */
export function email() {
	return {
		type: 'string',
		format: 'empyria-email',
		description: 'Email address',
	}
}

/**
 * JSON schema for a password string, checked against the `password` format
 * ({@link EMPYRIA_FORMATS}, which mirrors {@link P_PASS}: lower-case, upper-case, a digit,
 * and at least 8 characters).
 * @returns {Object} String schema with `format` and `description` set.
 */
export function password() {
	return {
		type: 'string',
		format: 'empyria-password',
		description: 'password',
	}
}

/**
 * JSON schema for an IPv4-address string, checked against the `ipv4` format
 * ({@link EMPYRIA_FORMATS}, which mirrors {@link P_IPv4}).
 * @returns {Object} String schema with `format` and `description` set.
 */
export function ip4() {
	return {
		type: 'string',
		format: 'empyria-ipv4',
		description: 'IP address v4',
	}
}

/**
 * JSON schema for an IPv6-address string, checked against the `ipv6` format
 * ({@link EMPYRIA_FORMATS}, which mirrors {@link P_IPv6}).
 * @returns {Object} String schema with `format` and `description` set.
 */
export function ip6() {
	return {
		type: 'string',
		format: 'empyria-ipv6',
		description: 'IP address v6',
	}
}
