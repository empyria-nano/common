import { describe, test, expect } from 'bun:test'
import { defaultsFromSchema } from '../lib/Defaulter.js'

describe('defaultsFromSchema', () => {
	test('uses each property default when present', () => {
		const schema = {
			type: 'object',
			properties: {
				name: { type: 'string', default: 'Bob' },
				age: { type: 'number', default: 30 },
			},
			required: ['name', 'age'],
		}
		expect(defaultsFromSchema(schema)).toEqual({ name: 'Bob', age: 30 })
	})

	test('falls back to a type-appropriate empty value for required properties without a default', () => {
		const schema = {
			type: 'object',
			properties: {
				name: { type: 'string' },
				active: { type: 'boolean' },
				count: { type: 'number' },
				tags: { type: 'array' },
			},
			required: ['name', 'active', 'count', 'tags'],
		}
		expect(defaultsFromSchema(schema)).toEqual({ name: '', active: false, count: 0, tags: [] })
	})

	test('returns an empty object for a non-object schema', () => {
		expect(defaultsFromSchema({ type: 'string' })).toEqual({})
	})
})
