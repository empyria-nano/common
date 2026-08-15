import { describe, test, expect } from 'bun:test'
import {
	MOLECULER_SERVICE_ROLE,
	PRINCIPIA_FEDERATION_ID,
	moleculerMeta,
	moleculerPrincipiaMeta,
	workflowName,
	workflowId,
	identifyWorkflow,
	PrincipiaError,
} from '../index.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('moleculerMeta', () => {
	test('shapes the actor/tracing fields under user, plus tokenKey', () => {
		expect(
			moleculerMeta({
				actor: 'a',
				federation: 'f',
				flowID: 'flow',
				processID: 'proc',
				role: 'role',
				tokenKey: 'key',
			}),
		).toEqual({
			user: { actor: 'a', federation: 'f', flowID: 'flow', processID: 'proc', role: 'role' },
			tokenKey: 'key',
		})
	})
})

describe('moleculerPrincipiaMeta', () => {
	test('uses the federation ID as actor/federation and generates missing IDs', () => {
		// Regression test: this used to call an unimported `uuid()` and throw ReferenceError.
		const meta = moleculerPrincipiaMeta({ tokenKey: 'key' })
		expect(meta.user.actor).toBe(PRINCIPIA_FEDERATION_ID)
		expect(meta.user.federation).toBe(PRINCIPIA_FEDERATION_ID)
		expect(meta.user.role).toBe(MOLECULER_SERVICE_ROLE)
		expect(meta.user.flowID).toMatch(UUID_RE)
		expect(meta.user.processID).toMatch(UUID_RE)
	})

	test('keeps explicitly provided flowID/processID', () => {
		const meta = moleculerPrincipiaMeta({ flowID: 'f1', processID: 'p1', tokenKey: 'key' })
		expect(meta.user.flowID).toBe('f1')
		expect(meta.user.processID).toBe('p1')
	})
})

describe('workflowName', () => {
	test('joins and normalizes service:handler', () => {
		expect(workflowName({ service: 'my svc', handler: 'do-thing' })).toBe('MYSVC:DO-THING')
	})
})

describe('workflowId', () => {
	test('appends a UUID to the workflow name', () => {
		const id = workflowId({ service: 'svc', handler: 'h' })
		const [name, handler, uuidPart] = id.split(':')
		expect(`${name}:${handler}`).toBe('SVC:H')
		expect(uuidPart).toMatch(UUID_RE)
	})
})

describe('identifyWorkflow', () => {
	test('parses back the service and handler', () => {
		const id = workflowId({ service: 'svc', handler: 'h' })
		expect(identifyWorkflow(id)).toEqual({ service: 'SVC', handler: 'H' })
	})

	test('throws a PrincipiaError for a malformed ID', () => {
		expect(() => identifyWorkflow('too:short')).toThrow(PrincipiaError)
		expect(() => identifyWorkflow(undefined)).toThrow(PrincipiaError)
	})
})
