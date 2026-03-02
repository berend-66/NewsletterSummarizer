import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyPassword,
} from './password-auth.ts'

test('normalizeEmail lowercases and trims values', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com')
})

test('isValidEmail accepts expected format', () => {
  assert.equal(isValidEmail('user@example.com'), true)
  assert.equal(isValidEmail('user@example'), false)
  assert.equal(isValidEmail('userexample.com'), false)
})

test('isValidPassword enforces minimum length', () => {
  assert.equal(isValidPassword('1234567'), false)
  assert.equal(isValidPassword('12345678'), true)
})

test('hashPassword and verifyPassword roundtrip', () => {
  const password = 'correct-horse-battery-staple'
  const hash = hashPassword(password)

  assert.equal(verifyPassword(password, hash), true)
  assert.equal(verifyPassword('wrong-password', hash), false)
})
