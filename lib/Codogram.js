import { enumise } from '@empyria/classification'

import Clerobee from 'clerobee'
import { BaseErrors } from './Errors.js'

const clerobee = new Clerobee(process.env.EMPYRIA_ID_LENGTH || 32)

const CPIN = 'PIN'
const CODE = 'Code'
const CABC = 'ABC'
const CABN = 'ABC Num'
/** The set of codogram type identifiers accepted by {@link generateCodogram}. */
const CODOGRAM_LIST = [CPIN, CODE, CABC, CABN]
/** {@link CODOGRAM_LIST}, normalized into a `{NAME: value}` enum via `enumise`. */
const CODOGRAMS = enumise(CODOGRAM_LIST)

const CPIN_LENGTH = 6
const CODE_LENGTH = 16
const CABC_LENGTH = 6
const CABN_LENGTH = 6

/**
 * Generates a one-time codogram (challenge code) for SMS/TOTP-style verification flows.
 * @param {string} type - One of {@link CODOGRAM_LIST}: `'PIN'` (numeric), `'Code'` (alphanumeric),
 *   `'ABC'` (alphabetic), or `'ABC Num'` (alphanumeric via Clerobee).
 * @param {Object} [options={}]
 * @param {number} [options.length] - Overrides the type's default length.
 * @returns {number|string} A numeric PIN for `'PIN'`, otherwise an upper-cased string.
 * @throws {EmpyriaError} `BaseErrors.UnrecognisedType` if `type` isn't one of {@link CODOGRAM_LIST}.
 */
export function generateCodogram(type, options = {}) {
	switch (type) {
		case CPIN:
			return Math.floor(Math.random() * Math.pow(10, options.length || CPIN_LENGTH))
		case CODE:
			return clerobee.generate(options.length || CODE_LENGTH).toUpperCase()
		case CABC:
			return clerobee.generateAbcString(options.length || CABC_LENGTH).toUpperCase()
		case CABN:
			return clerobee.generateAbcNumString(options.length || CABN_LENGTH).toUpperCase()
		default:
			throw new BaseErrors.UnrecognisedType({ type })
	}
}

export { CODOGRAM_LIST, CODOGRAMS }
