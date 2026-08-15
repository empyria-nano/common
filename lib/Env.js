import { clone } from '@principia/classification'

import { defineSchema, bool, number, tmpFile, string, logLevel, logFile, nodeEnv } from './Ata.js'

/** Environment schema shared by every Principia microservice. */
const DEFAULT_SERVICE_SCHEMA = {
	PRINCIPIA_ID_LENGTH: number(32),

	TMP_FOLDER: tmpFile(),

	LOG_LEVEL: logLevel(),
	LOG_FILE: logFile(),

	NODE_ENV: nodeEnv(),

	PAGE_LIMIT: number(100),

	RESET: bool(false),

	MOLECULER_CACHE_URL: string('redis://localhost:6379/15'),
}

/** {@link DEFAULT_SERVICE_SCHEMA} plus the connection settings shared by connector services. */
const DEFAULT_CONNECTOR_SCHEMA = Object.assign(
	{
		PRINCIPIA_CLICKHOUSE_URL: string('http://localhost:8123'),
		PRINCIPIA_CLICKHOUSE_USER: string('default'),
		PRINCIPIA_CLICKHOUSE_PASS: string('password123'),
		PRINCIPIA_CLICKHOUSE_DB: string('principia'),

		PRINCIPIA_MONGO_DB: string('principia'),
		PRINCIPIA_MONGO_URI: string('mongodb://localhost:27017/'),
	},
	clone(DEFAULT_SERVICE_SCHEMA),
)

/**
 * Builds a JSON schema for a microservice's environment variables, merging the
 * Principia-wide defaults with any service-specific additions/overrides.
 * @param {Object} [specificSchema] - Additional or overriding property schemas, keyed by env var name.
 * @returns {Object} A JSON schema object (see `defineSchema` in `./Ata.js`).
 */
export function createEnv(specificSchema) {
	return defineSchema(Object.assign({}, DEFAULT_SERVICE_SCHEMA, specificSchema))
}

/**
 * Like {@link createEnv}, but also includes the default connector (ClickHouse/Mongo) settings.
 * @param {Object} [specificSchema] - Additional or overriding property schemas, keyed by env var name.
 * @returns {Object} A JSON schema object (see `defineSchema` in `./Ata.js`).
 */
export function createConnectorEnv(specificSchema) {
	return defineSchema(Object.assign({}, DEFAULT_CONNECTOR_SCHEMA, specificSchema))
}
