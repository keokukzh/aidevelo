/**
 * API key generation and verification.
 * Format: aidev_live_<32 random hex bytes>  (total ~44 chars)
 * Storage: SHA-256 hash of the full key (hex encoded)
 */
import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "aidev_live_";
const KEY_BYTES = 32; // 32 bytes = 64 hex chars

export interface GeneratedApiKey {
  /** Plaintext key — shown to user ONLY once at creation */
  plaintext: string;
  /** SHA-256 hash stored in DB for verification */
  hash: string;
}

/**
 * Generate a new API key.
 * The plaintext must be returned to the user exactly once.
 */
export function generateApiKey(): GeneratedApiKey {
  const randomBytesHex = randomBytes(KEY_BYTES).toString("hex");
  const plaintext = KEY_PREFIX + randomBytesHex;
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

/**
 * Hash a plaintext API key for storage lookup.
 * Uses SHA-256 (same as what Stripe uses for API key hashing).
 */
export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/**
 * Verify a plaintext key against a stored hash.
 */
export function verifyApiKey(plaintext: string, hash: string): boolean {
  return hashApiKey(plaintext) === hash;
}

/**
 * Check if a string looks like a valid Aidevelo API key
 * (prefix + correct length, without inspecting the hash).
 */
export function looksLikeApiKey(key: string): boolean {
  return key.startsWith(KEY_PREFIX) && key.length === KEY_PREFIX.length + KEY_BYTES * 2;
}
