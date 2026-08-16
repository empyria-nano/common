import { defineSchema, bool, number, tmpFile, string, logLevel, logFile, nodeEnv } from './Ata.js'

/** Environment schema shared by every Principia microservice. */
const DEFAULT_SERVICE_SCHEMA = {
	PRINCIPIA_ID_LENGTH: number(32),

	TMP_FOLDER: tmpFile(),

	LOG_LEVEL: logLevel(),
	LOG_FILE: logFile(),

	NODE_ENV: nodeEnv(),

	RESET: bool(false),

	MOLECULER_CACHE_ENABLED: bool(false),
	MOLECULER_CACHE_PREFIX: string('Principia'),
	MOLECULER_CACHE_URL: string('redis://localhost:6379/15'),
}

/**
 * Builds a JSON schema for a microservice's environment variables, merging the
 * Principia-wide defaults with any service-specific additions/overrides.
 * @param {Object} [specificSchema] - Additional or overriding property schemas, keyed by env var name.
 * @returns {Object} A JSON schema object (see `defineSchema` in `./Ata.js`).
 */
export function createEnv(specificSchema) {
	return defineSchema(Object.assign({}, DEFAULT_SERVICE_SCHEMA, specificSchema))
}
