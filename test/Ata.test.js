import { describe, test, expect } from 'bun:test'
import {
	P_EMAIL,
	P_PASS,
	P_IPv4,
	P_IPv6,
	cloneBySchema,
	defineSchema,
	validate,
	bool,
	string,
	enumType,
	logLevel,
	tmpFile,
	logFile,
	nodeEnv,
	number,
	email,
	password,
	ip4,
	ip6,
	renderCompact,
	renderJSON,
} from '../lib/Ata.js'
import { PrincipiaError } from '../lib/Errors.js'

describe('P_EMAIL', () => {
	const re = new RegExp(`^${P_EMAIL}`, 'i')

	test('matches a well-formed email', () => {
		expect(re.test('user@example.com')).toBe(true)
	})

	test('rejects a non-dot character standing in for the label separator', () => {
		// Regression test: the pattern's inter-label separator used to be an unescaped
		// `.` (matches any character) instead of a literal dot.
		expect(re.test('user@example!com')).toBe(false)
	})
})

describe('P_PASS', () => {
	const re = new RegExp(P_PASS)

	test('matches a password with lower, upper, digit, and 8+ length', () => {
		expect(re.test('Abcdefg1')).toBe(true)
	})

	test('rejects a password missing a digit', () => {
		expect(re.test('Abcdefgh')).toBe(false)
	})
})

describe('P_IPv4', () => {
	const re = new RegExp(`^${P_IPv4}`)

	test('matches a valid IPv4 address', () => {
		expect(re.test('192.168.0.1')).toBe(true)
	})

	test('rejects an out-of-range octet', () => {
		expect(re.test('999.168.0.1')).toBe(false)
	})
})

describe('P_IPv6', () => {
	const re = new RegExp(`^${P_IPv6}`)

	test('matches the loopback address', () => {
		expect(re.test('::1')).toBe(true)
	})

	test('rejects a plain non-IPv6 string', () => {
		expect(re.test('not-an-ip')).toBe(false)
	})
})

describe('defineSchema', () => {
	test('builds an object schema requiring every key', () => {
		expect(defineSchema({ a: string('x') })).toEqual({
			type: 'object',
			properties: { a: { type: 'string', default: 'x' } },
			required: ['a'],
			additionalProperties: true,
		})
	})

	test('disallows extra properties when strict', () => {
		expect(defineSchema({ a: string() }, { strict: true }).additionalProperties).toBe(false)
	})
})

describe('cloneBySchema', () => {
	test('keeps only the keys declared on the schema', () => {
		const cloner = cloneBySchema({ properties: { a: {}, b: {} } })
		expect(cloner({ a: 1, b: 2, c: 3 })).toEqual({ a: 1, b: 2 })
	})
})

describe('createValidator / validate', () => {
	const schema = defineSchema({ name: string() })

	test('returns the input unchanged when valid', () => {
		expect(validate(schema, { name: 'Bob' })).toEqual({ name: 'Bob' })
	})

	test('throws a PrincipiaError with a rendered message when invalid', () => {
		try {
			validate(schema, {})
			throw new Error('should have thrown')
		} catch (err) {
			expect(err).toBeInstanceOf(PrincipiaError)
			expect(err.errorName).toBe('ValidationError')
			expect(err.message).toContain('name')
		}
	})
})

describe('schema builders', () => {
	test('bool sets a default when provided', () => {
		expect(bool(true)).toEqual({ type: 'boolean', default: true })
		expect(bool()).toEqual({ type: 'boolean' })
	})

	test('string sets default and minLength when provided', () => {
		expect(string('x', 3)).toEqual({ type: 'string', default: 'x', minLength: 3 })
	})

	test('number sets a default when provided', () => {
		expect(number(5)).toEqual({ type: 'number', default: 5 })
	})

	test('enumType sets the allowed list and default', () => {
		expect(enumType(['a', 'b'], 'a')).toEqual({ enum: ['a', 'b'], default: 'a' })
	})

	test('logLevel defaults to info', () => {
		expect(logLevel().default).toBe('info')
		expect(logLevel().enum).toContain('debug')
	})

	test('tmpFile defaults to ./tmp', () => {
		expect(tmpFile()).toEqual({ type: 'string', default: './tmp' })
	})

	test('logFile defaults to ./tmp/moleculer.log', () => {
		expect(logFile()).toEqual({ type: 'string', default: './tmp/moleculer.log' })
	})

	test('nodeEnv defaults to local', () => {
		expect(nodeEnv()).toEqual({
			enum: ['production', 'development', 'local'],
			default: 'local',
		})
	})

	test('email/password/ip4/ip6 reference their patterns', () => {
		expect(email().pattern).toBe(P_EMAIL)
		expect(password().pattern).toBe(P_PASS)
		expect(ip4().pattern).toBe(P_IPv4)
		expect(ip6().pattern).toBe(P_IPv6)
	})
})

describe('renderCompact / renderJSON re-exports', () => {
	test('are re-exported from ata-validator', () => {
		expect(typeof renderCompact).toBe('function')
		expect(typeof renderJSON).toBe('function')
	})
})
