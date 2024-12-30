import crypto from 'crypto';

export function generatePKCECodes() {
	// Generate a random code verifier
	const verifier = crypto.randomBytes(32).toString('base64url');

	// Create SHA-256 hash of verifier
	const challenge = crypto
		.createHash('sha256')
		.update(verifier)
		.digest('base64url');

	return { verifier, challenge };
}