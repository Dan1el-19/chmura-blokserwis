export type PasskeyEnvironment = 'insecure' | 'unsupported' | null;

export function getPasskeyEnvironment(
	isSecureContext: boolean,
	hasWebAuthn: boolean
): PasskeyEnvironment {
	if (!isSecureContext) return 'insecure';
	if (!hasWebAuthn) return 'unsupported';
	return null;
}
