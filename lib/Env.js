import { defineSchema, bool, number, tmpFile, string, logLevel, logFile, nodeEnv } from './Ata.js'

/** Environment schema shared by every Empyria microservice. */
const DEFAULT_SERVICE_SCHEMA = {
	EMPYRIA_ID_LENGTH: number(32),

	TMP_FOLDER: tmpFile(),

	LOG_LEVEL: logLevel(),
	LOG_FILE: logFile(),

	NODE_ENV: nodeEnv(),

	RESET: bool(false),

	MOLECULER_TRANSPORTER: string('TCP'),

	MOLECULER_CACHE_ENABLED: bool(false),
	MOLECULER_CACHE_PREFIX: string('Empyria'),
	MOLECULER_CACHE_URL: string('redis://redis:6379/15'),

	RESTATE_ADMIN_URL: string('http://restate:9070'),
	RESTATE_URL: string('http://restate:9071'),
}

/**
 * Builds a JSON schema for a microservice's environment variables, merging the
 * Empyria-wide defaults with any service-specific additions/overrides.
 * @param {Object} [specificSchema] - Additional or overriding property schemas, keyed by env var name.
 * @param {Object} [options={}]
 * @param {boolean} [options.closed] - When true, the schema rejects the whole of
 *   `process.env` beyond its declared keys and binds `{ coerceTypes: true, removeAdditional:
 *   true }` to itself, so `validate`/`parse` return an object holding *only* the declared
 *   vars — no undeclared environment riding along into `settings`. Off by default:
 *   `additionalProperties: true`, every extra var passes through unchanged.
 * @returns {Object} A JSON schema object (see `defineSchema` in `./Ata.js`).
 */
export function createEnv(specificSchema, { closed = false } = {}) {
	return defineSchema(
		Object.assign({}, DEFAULT_SERVICE_SCHEMA, specificSchema),
		closed ? { strict: true, validation: { coerceTypes: true, removeAdditional: true } } : {},
	)
}
