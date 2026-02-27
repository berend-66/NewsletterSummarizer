const preferredBaseUrl = process.env.SMOKE_BASE_URL
const runtimeUser = process.env.SMOKE_USER_ID || 'smoke-user@example.com'

async function request(baseUrl, path, options = {}) {
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
  const baseUrlCandidates = preferredBaseUrl
    ? [preferredBaseUrl]
    : ['http://127.0.0.1:3000', 'http://127.0.0.1:3001']

  let activeBaseUrl = null
  for (const candidate of baseUrlCandidates) {
    try {
      const healthCheck = await request(candidate, '/api/health')
      if (healthCheck.response.ok && healthCheck.body?.status === 'ok') {
        activeBaseUrl = candidate
        break
      }
    } catch {
      // Try next candidate.
    }
  }

  assert(
    activeBaseUrl,
    `Could not reach a healthy app instance. Tried: ${baseUrlCandidates.join(', ')}`
  )

  const commonHeaders = {
    'x-user-id': runtimeUser,
  }

  const health = await request(activeBaseUrl, '/api/health')
  assert(health.response.ok, `Health endpoint failed: ${health.response.status}`)
  assert(health.body?.status === 'ok', 'Health endpoint returned unexpected payload')

  const settings = await request(activeBaseUrl, '/api/settings', { headers: commonHeaders })
  assert(settings.response.ok, `Settings endpoint failed: ${settings.response.status}`)
  assert(Array.isArray(settings.body?.rssFeeds), 'Settings payload is missing rssFeeds[]')

  const progress = await request(activeBaseUrl, '/api/progress', { headers: commonHeaders })
  assert(progress.response.ok, `Progress endpoint failed: ${progress.response.status}`)
  assert(typeof progress.body?.active === 'boolean', 'Progress payload is missing active flag')

  const newsletters = await request(activeBaseUrl, '/api/newsletters?days=7&summarize=false', {
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

  console.log(`Smoke e2e checks passed on ${activeBaseUrl}.`)
}

main().catch((error) => {
  console.error('Smoke e2e checks failed:', error.message)
  process.exit(1)
})
