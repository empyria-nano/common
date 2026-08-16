import { describe, test, expect } from 'bun:test'
import { createEnv } from '../lib/Env.js'

describe('createEnv', () => {
	test('includes the shared service defaults plus service-specific additions', () => {
		const schema = createEnv({ CUSTOM_FLAG: { type: 'boolean' } })
		expect(schema.type).toBe('object')
		expect(schema.properties.NODE_ENV.default).toBe('local')
		expect(schema.properties.EMPYRIA_ID_LENGTH.default).toBe(32)
		expect(schema.properties.CUSTOM_FLAG).toEqual({ type: 'boolean' })
		expect(schema.required).toContain('CUSTOM_FLAG')
	})

	test('does not include connector-only settings', () => {
		const schema = createEnv()
		expect(schema.properties.EMPYRIA_MONGO_URI).toBeUndefined()
	})
})
