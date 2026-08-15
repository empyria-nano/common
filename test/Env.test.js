import { describe, test, expect } from 'bun:test'
import { createEnv, createConnectorEnv } from '../lib/Env.js'

describe('createEnv', () => {
	test('includes the shared service defaults plus service-specific additions', () => {
		const schema = createEnv({ CUSTOM_FLAG: { type: 'boolean' } })
		expect(schema.type).toBe('object')
		expect(schema.properties.NODE_ENV.default).toBe('local')
		expect(schema.properties.PRINCIPIA_ID_LENGTH.default).toBe(32)
		expect(schema.properties.CUSTOM_FLAG).toEqual({ type: 'boolean' })
		expect(schema.required).toContain('CUSTOM_FLAG')
	})

	test('does not include connector-only settings', () => {
		const schema = createEnv()
		expect(schema.properties.PRINCIPIA_MONGO_URI).toBeUndefined()
	})
})

describe('createConnectorEnv', () => {
	test('includes both service and connector defaults', () => {
		const schema = createConnectorEnv()
		expect(schema.properties.NODE_ENV.default).toBe('local')
		expect(schema.properties.PRINCIPIA_MONGO_URI.default).toBe('mongodb://localhost:27017/')
		expect(schema.properties.PRINCIPIA_CLICKHOUSE_DB.default).toBe('principia')
	})
})
