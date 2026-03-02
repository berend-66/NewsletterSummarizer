import db, { ensureDatabaseInitialized } from './persistent-db'
import { normalizeEmail } from './password-auth'

export interface AppUser {
  id: number
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export async function findAppUserByEmail(email: string): Promise<AppUser | null> {
  await ensureDatabaseInitialized()
  const normalizedEmail = normalizeEmail(email)

  const result = await db.query(
    `
      SELECT id, email, password_hash, created_at, updated_at
      FROM app_users
      WHERE email = $1
      LIMIT 1
    `,
    [normalizedEmail]
  )

  const row = result.rows[0] as
    | {
        id: number
        email: string
        password_hash: string
        created_at: string | Date
        updated_at: string | Date
      }
    | undefined
  if (!row) return null

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  }
}

export async function createAppUser(email: string, passwordHash: string): Promise<AppUser> {
  await ensureDatabaseInitialized()
  const normalizedEmail = normalizeEmail(email)
  const nowIso = new Date().toISOString()

  await db.query(
    `
      INSERT INTO app_users (email, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3::timestamptz, $4::timestamptz)
    `,
    [normalizedEmail, passwordHash, nowIso, nowIso]
  )

  const created = await findAppUserByEmail(normalizedEmail)
  if (!created) {
    throw new Error('Failed to create user')
  }

  return created
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeCode = (error as { code?: string }).code
  if (maybeCode === '23505') return true

  const maybeMessage = (error as { message?: string }).message || ''
  return (
    maybeMessage.includes('UNIQUE constraint failed') ||
    maybeMessage.includes('duplicate key value violates unique constraint')
  )
}
