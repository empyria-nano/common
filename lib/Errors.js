import { inherits } from 'util'

import { templating } from '@empyria/classification'

/**
 * Empyria's base error type. Carries a machine-readable `errorName`/`errorCode`
 * alongside the usual `message`, and captures its own stack trace.
 * @constructor
 * @param {string} message - Human-readable error message.
 * @param {string} [errorName] - Machine-readable error identifier.
 * @param {number} [errorCode] - Numeric error code.
 */
let EmpyriaError = function (message, errorName, errorCode) {
	this.message = message
	this.errorName = errorName
	this.errorCode = errorCode
	Error.captureStackTrace(this, EmpyriaError)
}
inherits(EmpyriaError, Error)

/**
 * Builds a reusable error factory from a template.
 * @param {Object} [options={}]
 * @param {number} [options.errorCode] - Numeric error code, used as the fallback `errorName`.
 * @param {string} [options.errorName] - Machine-readable error identifier.
 * @param {string} [options.message] - Message template with `{param}` placeholders (see
 *   `templating` in `@empyria/classification`).
 * @returns {(opts?: Object) => EmpyriaError} Function that, given template values, returns a
 *   new {@link EmpyriaError} with its `message` filled in and `params` set to the values used.
 */
let ErrorCreator = function (options = {}) {
	let errorCode = options.errorCode
	let args = Object.assign({}, options)
	delete args['message']
	delete args['code']
	delete args['errorCode']
	let fnc = function (opts = {}) {
		let newArgs = Object.assign({}, args, opts)
		let message = templating(options.message, newArgs)
		let resultError = new EmpyriaError(message, options.errorName || errorCode, errorCode)
		resultError.params = newArgs
		return resultError
	}
	return fnc
}

/**
 * Empyria's catalog of pre-built error factories, one per well-known failure case.
 * Each entry is a function built via {@link ErrorCreator} — call it with the template's
 * parameters (e.g. `BaseErrors.EntityInvalid({ type: 'User', id: 42 })`) to get a
 * {@link EmpyriaError} instance ready to `throw`.
 */
let BaseErrors = {
	InvalidModel: ErrorCreator({
		errorCode: 599993,
		errorName: 'InvalidModel',
		message: 'Model {name} is not a valid definition',
	}),
	Exceeded: ErrorCreator({
		errorCode: 599994,
		errorName: 'Exceeded',
		message: 'Limit of {limit} is exceeded',
	}),
	NotConnected: ErrorCreator({
		errorCode: 599995,
		errorName: 'NotConnected',
		message: '{service} is not connected',
	}),
	ConnectorMandatory: ErrorCreator({
		errorCode: 599996,
		errorName: 'ConnectorMandatory',
		message: 'Presence of a Connector instance is mandatory',
	}),
	NotInited: ErrorCreator({
		errorCode: 599997,
		errorName: 'NotInited',
		message: 'Empyria is not inited',
	}),
	UnImplemented: ErrorCreator({
		errorCode: 599998,
		errorName: 'UnImplemented',
		message: 'Service {service} is not implemented',
	}),
	ValidationError: ErrorCreator({
		errorCode: 599999,
		errorName: 'ValidationError',
		message: '{name} ({value}) failed on input parameter schema validation: {validation}',
	}),
	DataNotRecognised: ErrorCreator({
		errorCode: 600000,
		errorName: 'DataNotRecognised',
		message: 'Data type:{type} uid:{uid} is not recognised',
	}),
	UnrecognisedType: ErrorCreator({
		errorCode: 600001,
		errorName: 'UnrecognisedType',
		message: 'Entity type {type} is not recognised',
	}),
	MissingData: ErrorCreator({
		errorCode: 600002,
		errorName: 'MissingData',
		message: "Data '{type}' is missing",
	}),
	InformationInvalid: ErrorCreator({
		errorCode: 600003,
		errorName: 'InformationInvalid',
		message: 'Data {type} is not valid',
	}),
	EntityInvalid: ErrorCreator({
		errorCode: 600004,
		errorName: 'EntityInvalid',
		message: '{type}:{id} is not valid',
	}),
	DataNotOwned: ErrorCreator({
		errorCode: 600005,
		errorName: 'DataNotOwned',
		message: 'Data type:{type} uid:{uid} is not owned',
	}),
	HistoryViolation: ErrorCreator({
		errorCode: 600006,
		errorName: 'HistoryViolation',
		message: 'History violation with data type:{type} uid:{uid}',
	}),
	InvalidBinding: ErrorCreator({
		errorCode: 600007,
		errorName: 'InvalidBinding',
		message: 'Binding {uid1} with {uid2} is not valid',
	}),
	ConnectedServiceMissing: ErrorCreator({
		errorCode: 600008,
		errorName: 'ConnectedServiceMissing',
		message: 'Connected service {service} is missing',
	}),
	ServiceVoilation: ErrorCreator({
		errorCode: 600009,
		errorName: 'ServiceVoilation',
		message: 'Requested {service} maneuver is not permitted.',
	}),
	Illegalchange: ErrorCreator({
		errorCode: 600010,
		errorName: 'Illegalchange',
		message: 'Requested {alter} change on entity {entity} is not permitted.',
	}),
	InternalUnknownError: ErrorCreator({
		errorCode: 600011,
		errorName: 'InternalUnknownError',
		message: 'Error: {message} {code}',
	}),
	AlternedData: ErrorCreator({
		errorCode: 600012,
		errorName: 'AlternedData',
		message: 'Data {data} has been altered. {message}',
	}),
	AlreadyRegisteredError: ErrorCreator({
		errorCode: 600013,
		errorName: 'AlreadyRegisteredError',
		message: 'User with {data} has already registered. Please sign in instead.',
	}),
	ServiceFailureError: ErrorCreator({
		errorCode: 600014,
		errorName: 'ServiceFailureError',
		message: 'Error: {service} failed with: {message}',
	}),
}

export { EmpyriaError, ErrorCreator, BaseErrors }
