import { Validator } from 'ata-validator'

/**
 * Recursively builds an object populated with each property's schema `default`
 * (or a type-appropriate empty value for required properties without one).
 * @param {Object} schema - A JSON schema (object type, with `properties`).
 * @returns {Object} The built object; `{}` if `schema` isn't an object schema.
 */
function buildEmpty(schema) {
	if (schema.type === 'object' && schema.properties) {
		const obj = {}
		for (const [key, prop] of Object.entries(schema.properties)) {
			if (prop.type === 'object') {
				obj[key] = prop.default ?? buildEmpty(prop)
			} else if (!schema.required?.includes(key)) {
				continue
			}

			if (prop.type === 'array') {
				obj[key] = prop.default ?? []
			} else if (prop.type === 'string') {
				obj[key] = prop.default ?? ''
			} else if (prop.type === 'boolean') {
				obj[key] = prop.default ?? false
			} else if (prop.type === 'number' || prop.type === 'integer') {
				obj[key] = prop.default ?? 0
			}
		}
		return obj
	}
	return {}
}

/**
 * Builds a fully-populated default object for a JSON schema: every property gets its
 * schema `default`, falling back to a type-appropriate empty value, then runs the
 * result through an ata-validator `Validator` to fill in anything `buildEmpty` missed.
 * @param {Object} schema - A JSON schema (object type, with `properties`).
 * @returns {Object} The schema's default object.
 */
export function defaultsFromSchema(schema) {
	const obj = buildEmpty(schema)
	new Validator(schema).validate(obj)
	return obj
}
