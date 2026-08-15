import { describe, test, expect } from 'bun:test'
import { PrincipiaError, ErrorCreator, BaseErrors } from '../lib/Errors.js'

describe('PrincipiaError', () => {
	test('carries message, errorName, and errorCode', () => {
		const err = new PrincipiaError('Something broke', 'SomeError', 12345)
		expect(err).toBeInstanceOf(Error)
		expect(err.message).toBe('Something broke')
		expect(err.errorName).toBe('SomeError')
		expect(err.errorCode).toBe(12345)
		expect(typeof err.stack).toBe('string')
	})
})

describe('ErrorCreator', () => {
	test('builds a factory that templates the message and stores params', () => {
		const factory = ErrorCreator({
			errorCode: 1,
			errorName: 'Custom',
			message: 'Value {value} is bad',
		})
		const err = factory({ value: 42 })
		expect(err).toBeInstanceOf(PrincipiaError)
		expect(err.message).toBe('Value 42 is bad')
		expect(err.errorName).toBe('Custom')
		expect(err.errorCode).toBe(1)
		// errorName (unlike message/code/errorCode) is not stripped from the template args,
		// so it ends up alongside the call-time params.
		expect(err.params).toEqual({ errorName: 'Custom', value: 42 })
	})

	test('falls back to errorCode as errorName when none is given', () => {
		const factory = ErrorCreator({ errorCode: 2, message: 'plain' })
		expect(factory().errorName).toBe(2)
	})
})

describe('BaseErrors', () => {
	test('EntityInvalid uses its own error name, not a copy-pasted one', () => {
		const err = BaseErrors.EntityInvalid({ type: 'User', id: 42 })
		expect(err.errorName).toBe('EntityInvalid')
		expect(err.errorCode).toBe(600004)
		expect(err.message).toBe('User:42 is not valid')
	})

	test('UnrecognisedType templates its message', () => {
		const err = BaseErrors.UnrecognisedType({ type: 'Widget' })
		expect(err.message).toBe('Entity type Widget is not recognised')
	})

	test('ValidationError templates its message', () => {
		const err = BaseErrors.ValidationError({ name: 'X', value: 'y', validation: 'z' })
		expect(err.message).toBe('X (y) failed on input parameter schema validation: z')
	})
})
