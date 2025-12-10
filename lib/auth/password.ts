/**
 * Password Hashing Utilities
 *
 * Provides secure password hashing and verification using bcryptjs.
 * Salt rounds: 12 (recommended for production as of 2025)
 *
 * Note: Using bcryptjs (pure JS) instead of bcrypt (native) for Next.js compatibility
 */

import bcrypt from 'bcryptjs';

/**
 * Number of salt rounds for bcrypt hashing
 * 12 rounds provides a good balance between security and performance
 * Higher values increase security but also increase processing time
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plain text password using bcrypt
 *
 * @param password - The plain text password to hash
 * @returns Promise that resolves to the hashed password
 * @throws Error if password is empty or hashing fails
 *
 * @example
 * ```typescript
 * const hashedPassword = await hashPassword('mySecurePassword123');
 * // Returns: $2b$12$KIXQQk5Y8gJ5kF5Y8gJ5kO5Y8gJ5kF5Y8gJ5kO5Y8gJ5kF5Y8gJ5k
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.trim().length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error('Failed to hash password: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Verifies a plain text password against a bcrypt hash
 *
 * @param password - The plain text password to verify
 * @param hash - The bcrypt hash to compare against
 * @returns Promise that resolves to true if password matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('mySecurePassword123', storedHash);
 * if (isValid) {
 *   // Password is correct
 * } else {
 *   // Password is incorrect
 * }
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    // If comparison fails (e.g., invalid hash format), return false
    // Don't throw error to prevent information leakage
    return false;
  }
}

/**
 * Checks if a string is already a bcrypt hash
 *
 * @param str - The string to check
 * @returns true if the string appears to be a bcrypt hash
 *
 * @example
 * ```typescript
 * isBcryptHash('$2b$12$...'); // true
 * isBcryptHash('plaintext');  // false
 * ```
 */
export function isBcryptHash(str: string): boolean {
  // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
  const bcryptRegex = /^\$2[aby]\$\d{2}\$.{53}$/;
  return bcryptRegex.test(str);
}

/**
 * Validates password strength
 *
 * @param password - The password to validate
 * @returns Object with validation result and optional error message
 *
 * Requirements:
 * - Minimum 6 characters (for basic security)
 * - Maximum 72 characters (bcrypt limitation)
 *
 * @example
 * ```typescript
 * const validation = validatePasswordStrength('abc');
 * if (!validation.isValid) {
 *   console.log(validation.error); // "Password must be at least 6 characters long"
 * }
 * ```
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  error?: string
} {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }

  // Bcrypt has a maximum password length of 72 bytes
  if (password.length > 72) {
    return { isValid: false, error: 'Password must be less than 72 characters long' };
  }

  return { isValid: true };
}
