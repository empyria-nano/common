import { randomUUID as uuid } from 'node:crypto'

import { TRANS } from '@principia/classification'

import { PrincipiaError, ErrorCreator, BaseErrors } from './lib/Errors.js'
import { createEnv } from './lib/Env.js'

export * from './lib/Ata.js'

export * from './lib/Codogram.js'

export * from './lib/Defaulter.js'

export { PrincipiaError, ErrorCreator, BaseErrors, createEnv }

/** Role tag Moleculer assigns to every Principia microservice. */
export const MOLECULER_SERVICE_ROLE = 'microservice'

/** The federation's own actor/federation ID, used for system-originated calls. */
export const PRINCIPIA_FEDERATION_ID =
	process.env.PRINCIPIA_FEDERATION_ID ?? '563ac2a1-3fe3-4c5f-b20f-6f33e5cbd680'

/**
 * Builds a Moleculer call-context `meta` object carrying Principia's actor/tracing fields.
 * @param {Object} params
 * @param {string} params.actor - ID of the user/service making the call.
 * @param {string} params.federation - Federation the call belongs to.
 * @param {string} params.flowID - ID correlating this call with the rest of its business flow.
 * @param {string} params.processID - ID correlating this call with the rest of its process/workflow run.
 * @param {string} params.role - Caller's role (see {@link MOLECULER_SERVICE_ROLE}).
 * @param {string} params.tokenKey - Auth token key for the call.
 * @returns {{user: {actor: string, federation: string, flowID: string, processID: string, role: string}, tokenKey: string}}
 */
export function moleculerMeta({ actor, federation, flowID, processID, role, tokenKey }) {
	return {
		user: {
			actor,
			federation,
			flowID,
			processID,
			role,
		},
		tokenKey,
	}
}

/**
 * Builds a {@link moleculerMeta} object for a system-originated (Principia-as-actor) call,
 * generating a `flowID`/`processID` when not supplied.
 * @param {Object} params
 * @param {string} [params.flowID] - Flow correlation ID; a new UUID is generated if omitted.
 * @param {string} [params.processID] - Process correlation ID; a new UUID is generated if omitted.
 * @param {string} params.tokenKey - Auth token key for the call.
 * @returns {ReturnType<typeof moleculerMeta>}
 */
export function moleculerPrincipiaMeta({ flowID, processID, tokenKey }) {
	return moleculerMeta({
		actor: PRINCIPIA_FEDERATION_ID,
		federation: PRINCIPIA_FEDERATION_ID,
		flowID: flowID ?? uuid(),
		processID: processID ?? uuid(),
		role: MOLECULER_SERVICE_ROLE,
		tokenKey,
	})
}

/**
 * Builds the stable `service:handler` name for a workflow, transliterated/upper-cased via `TRANS`.
 * @param {Object} workflow
 * @param {string} workflow.service - Owning service name.
 * @param {string} workflow.handler - Handler name within that service.
 * @returns {string} The workflow's normalized name.
 */
export const workflowName = (workflow) => {
	return TRANS(`${workflow?.service}:${workflow?.handler}`)
}

/**
 * Builds a unique workflow instance ID: {@link workflowName} plus a fresh UUID.
 * @param {Object} workflow - See {@link workflowName}.
 * @returns {string} `"SERVICE:HANDLER:<uuid>"`.
 */
export function workflowId(workflow) {
	return `${workflowName(workflow)}:${uuid()}`
}

/**
 * Parses a workflow ID (as produced by {@link workflowId}) back into its service/handler.
 * @param {string} workflowId - A `"SERVICE:HANDLER:<uuid>"`-shaped ID.
 * @returns {{service: string, handler: string}}
 * @throws {PrincipiaError} If `workflowId` doesn't have at least three `:`-separated components.
 */
export const identifyWorkflow = (workflowId) => {
	const components = workflowId?.split(':')
	if (!components || components.length < 3) {
		throw new PrincipiaError('Invalid workflow ID format')
	}
	return {
		service: components[0],
		handler: components[1],
	}
}
