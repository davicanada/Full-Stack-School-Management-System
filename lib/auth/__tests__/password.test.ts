/**
 * Tests for Password Utility Functions
 *
 * These tests verify the security-critical password hashing and verification functions.
 */

import {
  hashPassword,
  verifyPassword,
  isBcryptHash,
  validatePasswordStrength,
} from '../password'

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
      expect(hash).not.toBe(password) // Should not equal plain text
    })

    it('should generate different hashes for the same password (due to salt)', async () => {
      const password = 'samePassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2) // Different salts
      expect(hash1).toBeDefined()
      expect(hash2).toBeDefined()
    })

    it('should create bcrypt-formatted hashes', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      expect(hash).toMatch(/^\$2[aby]\$/)
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty')
    })

    it('should throw error for whitespace-only password', async () => {
      await expect(hashPassword('   ')).rejects.toThrow('Password cannot be empty')
    })

    it('should throw error for password shorter than 6 characters', async () => {
      await expect(hashPassword('12345')).rejects.toThrow('Password must be at least 6 characters long')
    })

    it('should accept password with exactly 6 characters', async () => {
      const hash = await hashPassword('123456')
      expect(hash).toBeDefined()
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should accept long passwords (up to 72 chars)', async () => {
      const longPassword = 'a'.repeat(72)
      const hash = await hashPassword(longPassword)
      expect(hash).toBeDefined()
      expect(isBcryptHash(hash)).toBe(true)
    })
  })

  describe('verifyPassword', () => {
    const testPassword = 'correctPassword123'
    let testHash: string

    beforeAll(async () => {
      testHash = await hashPassword(testPassword)
    })

    it('should verify correct password', async () => {
      const isValid = await verifyPassword(testPassword, testHash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const isValid = await verifyPassword('wrongPassword', testHash)
      expect(isValid).toBe(false)
    })

    it('should reject password with different case', async () => {
      const isValid = await verifyPassword('CORRECTPASSWORD123', testHash)
      expect(isValid).toBe(false)
    })

    it('should return false for empty password', async () => {
      const isValid = await verifyPassword('', testHash)
      expect(isValid).toBe(false)
    })

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword(testPassword, '')
      expect(isValid).toBe(false)
    })

    it('should return false for invalid hash format', async () => {
      const isValid = await verifyPassword(testPassword, 'invalid-hash')
      expect(isValid).toBe(false)
    })

    it('should handle special characters in password', async () => {
      const specialPassword = 'p@ssw0rd!#$%^&*()'
      const hash = await hashPassword(specialPassword)
      const isValid = await verifyPassword(specialPassword, hash)
      expect(isValid).toBe(true)
    })

    it('should handle unicode characters', async () => {
      const unicodePassword = 'senha123çãéñ中文'
      const hash = await hashPassword(unicodePassword)
      const isValid = await verifyPassword(unicodePassword, hash)
      expect(isValid).toBe(true)
    })
  })

  describe('isBcryptHash', () => {
    it('should recognize valid bcrypt hash with $2a$', () => {
      // Real bcrypt hash format: $2a$12$[22 char salt][31 char hash] = 60 total
      const hash = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should recognize valid bcrypt hash with $2b$', () => {
      const hash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should recognize valid bcrypt hash with $2y$', () => {
      const hash = '$2y$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should recognize actual bcrypt hash from hashPassword', async () => {
      const hash = await hashPassword('testPassword')
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('should reject plain text password', () => {
      expect(isBcryptHash('senha123')).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isBcryptHash('')).toBe(false)
    })

    it('should reject hash with wrong prefix', () => {
      expect(isBcryptHash('$2c$12$invalidhash')).toBe(false)
    })

    it('should reject hash with wrong length', () => {
      expect(isBcryptHash('$2b$12$tooshort')).toBe(false)
    })

    it('should reject hash without rounds', () => {
      expect(isBcryptHash('$2b$abcdefghijklmnopqrstuvwxyz')).toBe(false)
    })

    it('should reject MD5 hash', () => {
      expect(isBcryptHash('5f4dcc3b5aa765d61d8327deb882cf99')).toBe(false)
    })

    it('should reject SHA256 hash', () => {
      expect(isBcryptHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(false)
    })
  })

  describe('validatePasswordStrength', () => {
    it('should accept valid password with 6 characters', () => {
      const result = validatePasswordStrength('abc123')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid password with 10 characters', () => {
      const result = validatePasswordStrength('password10')
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept maximum length password (72 chars)', () => {
      const password = 'a'.repeat(72)
      const result = validatePasswordStrength(password)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject empty password', () => {
      const result = validatePasswordStrength('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Password is required')
    })

    it('should reject password shorter than 6 characters', () => {
      const result = validatePasswordStrength('12345')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Password must be at least 6 characters long')
    })

    it('should reject password longer than 72 characters', () => {
      const password = 'a'.repeat(73)
      const result = validatePasswordStrength(password)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Password must be less than 72 characters long')
    })

    it('should accept password with special characters', () => {
      const result = validatePasswordStrength('p@ssw0rd!')
      expect(result.isValid).toBe(true)
    })

    it('should accept password with spaces', () => {
      const result = validatePasswordStrength('pass word 123')
      expect(result.isValid).toBe(true)
    })

    it('should accept password with unicode', () => {
      const result = validatePasswordStrength('senha123ção')
      expect(result.isValid).toBe(true)
    })
  })

  describe('Integration Tests', () => {
    it('should complete full hash-verify cycle', async () => {
      const password = 'integrationTest123'

      // Hash the password
      const hash = await hashPassword(password)
      expect(isBcryptHash(hash)).toBe(true)

      // Verify correct password
      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)

      // Verify incorrect password
      const isInvalid = await verifyPassword('wrongPassword', hash)
      expect(isInvalid).toBe(false)
    })

    it('should maintain consistency across multiple operations', async () => {
      const password = 'consistencyTest456'

      // Create multiple hashes
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      const hash3 = await hashPassword(password)

      // All should be valid bcrypt hashes
      expect(isBcryptHash(hash1)).toBe(true)
      expect(isBcryptHash(hash2)).toBe(true)
      expect(isBcryptHash(hash3)).toBe(true)

      // All should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true)
      expect(await verifyPassword(password, hash2)).toBe(true)
      expect(await verifyPassword(password, hash3)).toBe(true)

      // All should reject wrong password
      expect(await verifyPassword('wrong', hash1)).toBe(false)
      expect(await verifyPassword('wrong', hash2)).toBe(false)
      expect(await verifyPassword('wrong', hash3)).toBe(false)
    })

    it('should validate before hashing (edge case)', async () => {
      const validation = validatePasswordStrength('abc')
      expect(validation.isValid).toBe(false)

      // If validation fails, hashing should also fail
      await expect(hashPassword('abc')).rejects.toThrow()
    })
  })

  describe('Security Tests', () => {
    it('should not hash the same password to the same value (salt uniqueness)', async () => {
      const password = 'securityTest789'
      const hashes = await Promise.all([
        hashPassword(password),
        hashPassword(password),
        hashPassword(password),
        hashPassword(password),
        hashPassword(password),
      ])

      // All hashes should be different (unique salts)
      const uniqueHashes = new Set(hashes)
      expect(uniqueHashes.size).toBe(5)

      // But all should verify the same password
      for (const hash of hashes) {
        expect(await verifyPassword(password, hash)).toBe(true)
      }
    })

    it('should resist timing attacks (constant time comparison)', async () => {
      const password = 'timingTest'
      const hash = await hashPassword(password)

      // These should all take similar time (bcrypt is naturally constant-time)
      const start1 = Date.now()
      await verifyPassword('a', hash)
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await verifyPassword('abcdefghijklmnop', hash)
      const time2 = Date.now() - start2

      // Times should be similar (within reasonable variance)
      // Note: This is a weak test, but demonstrates the concept
      expect(Math.abs(time1 - time2)).toBeLessThan(50)
    })

    it('should handle null/undefined gracefully', async () => {
      // @ts-expect-error Testing invalid input
      expect(await verifyPassword(null, 'hash')).toBe(false)

      // @ts-expect-error Testing invalid input
      expect(await verifyPassword('password', null)).toBe(false)

      // @ts-expect-error Testing invalid input
      expect(isBcryptHash(null)).toBe(false)

      // @ts-expect-error Testing invalid input
      expect(validatePasswordStrength(null).isValid).toBe(false)
    })
  })
})
