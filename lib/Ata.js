import { Validator, renderPretty, renderCompact, renderJSON } from 'ata-validator'

import { cloneSelected, defined } from '@principia/classification'
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
 * @param {boolean} [options.strict] - If true, disallows properties not listed in `schemaDef`.
 * @returns {Object} A JSON schema: `{ type: 'object', properties, required: <all keys>, additionalProperties }`.
 */
export function defineSchema(schemaDef, options = {}) {
	const schema = {
		type: 'object',
		properties: schemaDef,
		required: Object.keys(schemaDef),
		additionalProperties: !options.strict,
	}

	return schema
}

/**
 * Builds a validating function for a JSON schema.
 * @param {Object} schema - JSON schema to validate against.
 * @param {Object} [options] - Forwarded to `ata-validator`'s `Validator` constructor
 *   (`coerceTypes`, `removeAdditional`, `useDefaults`, ...). Left unset, validation is
 *   strict: a schema expecting `type: 'number'` rejects `"32"`. Pass `{ coerceTypes: true }`
 *   for input that's inherently string-typed, such as `process.env` (see `createEnv`).
 * @returns {(data: *) => *} Function that returns `data` unchanged if valid.
 * @throws {PrincipiaError} `BaseErrors.ValidationError` (with a pretty-rendered violation list
 *   in its `validation` param) if `data` doesn't satisfy the schema.
 */
export function createValidator(schema, options) {
	const v = new Validator(schema, options)

	return (data) => {
		const result = v.validate(data)
		if (!result.valid) {
			throw new BaseErrors.ValidationError({
				name: schema.title || schema.name || '',
				value: '',
				validation: renderPretty(result.errors),
			})
		}
		return data
	}
}

/**
 * Validates `input` against `schema` in one call.
 * @param {Object} schema - JSON schema to validate against.
 * @param {*} input - Value to validate.
 * @param {Object} [options] - Forwarded to {@link createValidator} (see its docs).
 * @returns {*} `input` unchanged, if valid.
 * @throws {PrincipiaError} `BaseErrors.ValidationError` if `input` doesn't satisfy the schema.
 */
export function validate(schema, input, options) {
	const validateInput = createValidator(schema, options)
	const validatedInput = validateInput(input)

	return validatedInput
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
 * JSON schema for an email-address string, pattern-matched against {@link P_EMAIL}.
 * @returns {Object} String schema with `pattern` and `description` set.
 */
export function email() {
	return {
		type: 'string',
		pattern: P_EMAIL,
		description: 'Email address',
	}
}

/**
 * JSON schema for a password string, pattern-matched against {@link P_PASS}
 * (requires lower-case, upper-case, a digit, and at least 8 characters).
 * @returns {Object} String schema with `pattern` and `description` set.
 */
export function password() {
	return {
		type: 'string',
		pattern: P_PASS,
		description: 'password',
	}
}

/**
 * JSON schema for an IPv4-address string, pattern-matched against {@link P_IPv4}.
 * @returns {Object} String schema with `pattern` and `description` set.
 */
export function ip4() {
	return {
		type: 'string',
		pattern: P_IPv4,
		description: 'IP address v4',
	}
}

/**
 * JSON schema for an IPv6-address string, pattern-matched against {@link P_IPv6}.
 * @returns {Object} String schema with `pattern` and `description` set.
 */
export function ip6() {
	return {
		type: 'string',
		pattern: P_IPv6,
		description: 'IP address v6',
	}
}
