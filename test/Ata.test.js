import { describe, test, expect } from 'bun:test'
import {
	P_EMAIL,
	P_PASS,
	P_IPv4,
	P_IPv6,
	cloneBySchema,
	defineSchema,
	validate,
	parse,
	createParser,
	createValidator,
	createChecker,
	checkSchema,
	schemaOptions,
	setAtaDefaults,
	getAtaDefaults,
	EMPYRIA_FORMATS,
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

	test('an explicit additionalProperties overrides strict', () => {
		expect(
			defineSchema({ a: string() }, { strict: true, additionalProperties: true })
				.additionalProperties,
		).toBe(true)
		expect(
			defineSchema({ a: string() }, { additionalProperties: false }).additionalProperties,
		).toBe(false)
	})

	test('binds validation options on a non-enumerable key, invisible to JSON/toEqual', () => {
		const schema = defineSchema(
			{ a: string() },
			{ validation: { coerceTypes: true, removeAdditional: true } },
		)
		expect(schema).toEqual({
			type: 'object',
			properties: { a: { type: 'string' } },
			required: ['a'],
			additionalProperties: true,
		})
		expect(JSON.stringify(schema)).not.toContain('coerceTypes')
		expect(schemaOptions(schema)).toEqual({ coerceTypes: true, removeAdditional: true })
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

	test('email/password/ip4/ip6 reference their named formats', () => {
		expect(email().format).toBe('empyria-email')
		expect(password().format).toBe('empyria-password')
		expect(ip4().format).toBe('empyria-ipv4')
		expect(ip6().format).toBe('empyria-ipv6')
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

	test('checkSchema returns valid:true, the parsed value, and no errors for good input', () => {
		expect(checkSchema(schema, { name: 'Bob' })).toEqual({
			valid: true,
			data: { name: 'Bob' },
			errors: [],
		})
	})

	test('checkSchema reports data:undefined for bad input', () => {
		expect(checkSchema(schema, {}).data).toBeUndefined()
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

	test('createChecker builds a reusable checker, forwards options, and returns the parsed value', () => {
		const check = createChecker(defineSchema({ port: number() }), { coerceTypes: true })
		expect(check({ port: '4040' })).toEqual({ valid: true, data: { port: 4040 }, errors: [] })
	})
})

describe('named formats', () => {
	test('EMPYRIA_FORMATS enforce their patterns', () => {
		expect(EMPYRIA_FORMATS['empyria-email']('user@example.com')).toBe(true)
		expect(EMPYRIA_FORMATS['empyria-email']('user@example!com')).toBe(false)
		expect(EMPYRIA_FORMATS['empyria-password']('Abcdefg1')).toBe(true)
		expect(EMPYRIA_FORMATS['empyria-password']('Abcdefgh')).toBe(false)
		expect(EMPYRIA_FORMATS['empyria-ipv4']('192.168.0.1')).toBe(true)
		expect(EMPYRIA_FORMATS['empyria-ipv4']('999.0.0.1')).toBe(false)
	})

	test('a schema from email() is enforced through this module without per-call wiring', () => {
		const schema = defineSchema({ addr: email() })
		expect(validate(schema, { addr: 'user@example.com' })).toEqual({ addr: 'user@example.com' })
		expect(() => validate(schema, { addr: 'nope' })).toThrow(EmpyriaError)
	})

	test('a schema from password() is enforced (no ata-validator built-in for it)', () => {
		const schema = defineSchema({ pw: password() })
		expect(() => validate(schema, { pw: 'weak' })).toThrow(EmpyriaError)
		expect(validate(schema, { pw: 'Abcdefg1' })).toEqual({ pw: 'Abcdefg1' })
	})

	test('a per-call formats entry overrides the Empyria default', () => {
		const schema = defineSchema({ addr: email() })
		const only = { formats: { 'empyria-email': (s) => s === 'ok@ok.io' } }
		expect(validate(schema, { addr: 'ok@ok.io' }, only)).toEqual({ addr: 'ok@ok.io' })
		expect(() => validate(schema, { addr: 'user@example.com' }, only)).toThrow(EmpyriaError)
	})
})

describe('option layering: setAtaDefaults / schema-bound / per-call', () => {
	test('getAtaDefaults starts empty', () => {
		expect(getAtaDefaults()).toEqual({})
	})

	test('a library default is applied when no per-call option is given', () => {
		const schema = defineSchema({ port: number() })
		expect(() => validate(schema, { port: '8080' })).toThrow(EmpyriaError)
		setAtaDefaults({ coerceTypes: true })
		try {
			expect(validate(schema, { port: '8080' })).toEqual({ port: 8080 })
		} finally {
			setAtaDefaults()
		}
		expect(getAtaDefaults()).toEqual({})
	})

	test('schema-bound validation options beat library defaults, per-call beats both', () => {
		setAtaDefaults({ coerceTypes: false })
		try {
			const bound = defineSchema({ port: number() }, { validation: { coerceTypes: true } })
			// schema-bound coerceTypes:true wins over the library default
			expect(validate(bound, { port: '80' })).toEqual({ port: 80 })
			// per-call coerceTypes:false wins over the schema-bound value
			expect(() => validate(bound, { port: '80' }, { coerceTypes: false })).toThrow(
				EmpyriaError,
			)
		} finally {
			setAtaDefaults()
		}
	})
})

describe('parse / createParser', () => {
	test('parse coerces and strips against a closed schema', () => {
		const schema = defineSchema(
			{ port: number() },
			{ strict: true, validation: { coerceTypes: true, removeAdditional: true } },
		)
		expect(parse(schema, { port: '3000', stray: 'x' })).toEqual({ port: 3000 })
	})

	test('createParser is a reusable createValidator under an intent-revealing name', () => {
		const p = createParser(defineSchema({ n: number() }), { coerceTypes: true })
		expect(p({ n: '7' })).toEqual({ n: 7 })
		expect(typeof createValidator).toBe('function')
	})
})
