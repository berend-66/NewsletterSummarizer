const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'
const runtimeUser = process.env.SMOKE_USER_ID || 'smoke-user@example.com'

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  return { response, body }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  const commonHeaders = {
    'x-user-id': runtimeUser,
  }

  const health = await request('/api/health')
  assert(health.response.ok, `Health endpoint failed: ${health.response.status}`)
  assert(health.body?.status === 'ok', 'Health endpoint returned unexpected payload')

  const settings = await request('/api/settings', { headers: commonHeaders })
  assert(settings.response.ok, `Settings endpoint failed: ${settings.response.status}`)
  assert(Array.isArray(settings.body?.rssFeeds), 'Settings payload is missing rssFeeds[]')

  const progress = await request('/api/progress', { headers: commonHeaders })
  assert(progress.response.ok, `Progress endpoint failed: ${progress.response.status}`)
  assert(typeof progress.body?.active === 'boolean', 'Progress payload is missing active flag')

  const newsletters = await request('/api/newsletters?days=7&summarize=false', {
    headers: commonHeaders,
  })
  const newsletterStatus = newsletters.response.status
  assert(
    newsletterStatus === 200 || newsletterStatus === 400,
    `Newsletters endpoint returned unexpected status: ${newsletterStatus}`
  )

  if (newsletterStatus === 400) {
    assert(
      typeof newsletters.body?.error === 'string',
      'Expected user-facing error when no feeds are configured'
    )
  }

  console.log('Smoke e2e checks passed.')
}

main().catch((error) => {
  console.error('Smoke e2e checks failed:', error.message)
  process.exit(1)
})
