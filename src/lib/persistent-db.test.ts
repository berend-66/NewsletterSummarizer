import test from 'node:test'
import assert from 'node:assert/strict'
import { convertPgStyleToSqlite } from './persistent-db.ts'

test('convertPgStyleToSqlite converts booleans for sqlite bindings', () => {
  const converted = convertPgStyleToSqlite(
    'UPDATE user_settings SET auto_detect = $1, digest_time = $2 WHERE user_id = $3',
    [false, '09:30', 'local-user']
  )

  assert.equal(
    converted.sql,
    'UPDATE user_settings SET auto_detect = ?, digest_time = ? WHERE user_id = ?'
  )
  assert.deepEqual(converted.params, [0, '09:30', 'local-user'])
})
