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
 * @param {boolean} [options.strict] - If true, disallows properties not listed in `schemaDef`
 *   (`additionalProperties: false`). Combine with `validation: { removeAdditional: true }` to
 *   *strip* unknown keys instead of rejecting them. Ignored when `options.additionalProperties`
 *   is given.
 * @param {boolean|Object} [options.additionalProperties] - Explicit `additionalProperties`
 *   value (a boolean, or a sub-schema for the extra keys). Overrides `options.strict`.
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
	const schema = {
		type: 'object',
		properties,
		required,
		additionalProperties: defined(options.additionalProperties)
			? options.additionalProperties
			: !options.strict,
	}

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
 * @param {number} [minLength] - Minimum string length, if greater than 0.
 * @returns {Object} `{ type: 'string', default?, minLength? }`.
 */
export function string(defaultValue, minLength) {
	const schema = {
		type: 'string',
	}
	if (defined(defaultValue)) schema.default = `${defaultValue}`
	if (minLength > 0) schema.minLength = minLength
	return schema
}

/**
 * JSON schema for an enumerated property.
 * @param {Array} list - Allowed values.
 * @param {*} [defaultValue] - Default value, if any.
 * @returns {Object} `{ enum: list, default? }`.
 */
export function enumType(list, defaultValue) {
	const schema = {
		enum: list,
	}
	if (defined(defaultValue)) schema.default = defaultValue
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
 * JSON schema for a numeric property.
 * @param {number} [defaultValue] - Default value, if any.
 * @returns {Object} `{ type: 'number', default? }`.
 */
export function number(defaultValue) {
	const schema = {
		type: 'number',
	}
	if (defined(defaultValue)) schema.default = Number(defaultValue)
	return schema
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
