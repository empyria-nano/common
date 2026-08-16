import { describe, test, expect } from 'bun:test'
import { generateCodogram, CODOGRAM_LIST, CODOGRAMS } from '../lib/Codogram.js'
import { EmpyriaError } from '../lib/Errors.js'

describe('generateCodogram', () => {
	test('PIN: numeric within the default digit range', () => {
		const result = generateCodogram('PIN')
		expect(Number.isInteger(result)).toBe(true)
		expect(result).toBeGreaterThanOrEqual(0)
		expect(result).toBeLessThan(1000000)
	})

	test('Code: upper-cased alphanumeric of the requested length', () => {
		const result = generateCodogram('Code', { length: 10 })
		expect(result).toBe(result.toUpperCase())
		expect(result.length).toBe(10)
	})

	test('ABC: upper-cased alphabetic string', () => {
		const result = generateCodogram('ABC')
		expect(result).toBe(result.toUpperCase())
		expect(typeof result).toBe('string')
	})

	test('ABC Num: upper-cased alphanumeric string', () => {
		const result = generateCodogram('ABC Num')
		expect(result).toBe(result.toUpperCase())
		expect(typeof result).toBe('string')
	})

	test('throws for an unrecognised type', () => {
		expect(() => generateCodogram('nonsense')).toThrow(EmpyriaError)
	})
})

describe('CODOGRAM_LIST / CODOGRAMS', () => {
	test('CODOGRAMS is a normalized-name map over CODOGRAM_LIST', () => {
		expect(CODOGRAM_LIST).toEqual(['PIN', 'Code', 'ABC', 'ABC Num'])
		expect(CODOGRAMS).toEqual({ PIN: 'PIN', CODE: 'Code', ABC: 'ABC', ABC_NUM: 'ABC Num' })
	})
})
