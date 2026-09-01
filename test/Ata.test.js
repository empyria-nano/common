import { describe, test, expect } from 'bun:test'
import {
	P_EMAIL,
	P_PASS,
	P_IPv4,
	P_IPv6,
	cloneBySchema,
	defineSchema,
	validate,
	createChecker,
	checkSchema,
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
import { EmpyriaError } from '../lib/Errors.js'

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

	test('throws a EmpyriaError with a rendered message when invalid', () => {
		try {
			validate(schema, {})
			throw new Error('should have thrown')
		} catch (err) {
			expect(err).toBeInstanceOf(EmpyriaError)
			expect(err.errorName).toBe('ValidationError')
			expect(err.message).toContain('name')
		}
	})

	test('is strict by default: a numeric string is rejected for a number schema', () => {
		const numSchema = defineSchema({ port: number() })
		expect(() => validate(numSchema, { port: '4040' })).toThrow(EmpyriaError)
	})

	test('options are forwarded to the underlying Validator (coerceTypes)', () => {
		// Regression test: process.env values are always strings (e.g. `PORT=4040` is
		// `"4040"`, not `4040`) — env-parsing callers need this to avoid rejecting every
		// explicitly-set numeric/boolean variable. See apps/*/env.js in empyria-nano-services.
		const numSchema = defineSchema({ port: number() })
		expect(validate(numSchema, { port: '4040' }, { coerceTypes: true })).toEqual({ port: 4040 })
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

	test('nodeEnv defaults to local and allows test', () => {
		// Regression test: bun test (and most JS test runners) set NODE_ENV=test
		// automatically. Omitting it from the enum would make it impossible for any app
		// validating process.env at import time to run its own test suite.
		expect(nodeEnv()).toEqual({
			enum: ['production', 'development', 'local', 'test'],
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

describe('createChecker / checkSchema', () => {
	const schema = defineSchema({ name: string() })

	test('checkSchema returns valid:true and no errors for good input', () => {
		expect(checkSchema(schema, { name: 'Bob' })).toEqual({ valid: true, errors: [] })
	})

	test('checkSchema returns valid:false and a non-empty error list for bad input, without throwing', () => {
		const result = checkSchema(schema, {})
		expect(result.valid).toBe(false)
		expect(Array.isArray(result.errors)).toBe(true)
		expect(result.errors.length).toBeGreaterThan(0)
	})

	test('checkSchema errors render through the re-exported renderCompact', () => {
		const { errors } = checkSchema(schema, {})
		expect(renderCompact(errors)).toContain('name')
	})

	test('createChecker builds a reusable checker and forwards options (coerceTypes)', () => {
		const check = createChecker(defineSchema({ port: number() }), { coerceTypes: true })
		expect(check({ port: '4040' })).toEqual({ valid: true, errors: [] })
	})
})
