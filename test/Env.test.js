import { describe, test, expect } from 'bun:test'
import { createEnv } from '../lib/Env.js'
import { validate, schemaOptions } from '../lib/Ata.js'

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

	test('is open by default: undeclared vars pass through untouched', () => {
		const schema = createEnv()
		expect(schema.additionalProperties).toBe(true)
		expect(schemaOptions(schema)).toEqual({})
		const out = validate(
			schema,
			{ NODE_ENV: 'test', UNDECLARED: 'ride-along' },
			{ coerceTypes: true },
		)
		expect(out.UNDECLARED).toBe('ride-along')
	})

	test('closed: rejects the wider environment and returns only the declared keys', () => {
		const schema = createEnv({}, { closed: true })
		expect(schema.additionalProperties).toBe(false)
		expect(schemaOptions(schema)).toEqual({ coerceTypes: true, removeAdditional: true })

		const out = validate(schema, {
			NODE_ENV: 'test',
			EMPYRIA_ID_LENGTH: '48',
			PATH: '/usr/bin',
			HOME: '/root',
		})
		expect(out.EMPYRIA_ID_LENGTH).toBe(48)
		expect(out.NODE_ENV).toBe('test')
		expect(out.PATH).toBeUndefined()
		expect(out.HOME).toBeUndefined()
	})
})
