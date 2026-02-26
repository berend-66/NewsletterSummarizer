function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function normalizeBaseUrl(value) {
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

async function main() {
  const appBaseUrl = normalizeBaseUrl(required('APP_BASE_URL'))
  const cronSecret = required('CRON_SECRET')
  const daysBack = Number.parseInt(process.env.DIGEST_DAYS_BACK ?? '7', 10)
  const timeoutMs = Number.parseInt(process.env.DIGEST_TIMEOUT_MS ?? '60000', 10)

  if (!Number.isFinite(daysBack) || daysBack < 1) {
    throw new Error('DIGEST_DAYS_BACK must be a positive integer')
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error('DIGEST_TIMEOUT_MS must be an integer >= 1000')
  }

  const endpoint = new URL('/api/cron/digest', appBaseUrl)
  endpoint.searchParams.set('days', String(daysBack))

  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      signal: controller.signal,
    })

    const body = await response.text()
    if (!response.ok) {
      throw new Error(
        `Digest cron request failed (${response.status} ${response.statusText}): ${body.slice(0, 500)}`
      )
    }

    console.log(
      JSON.stringify({
        status: 'ok',
        endpoint: endpoint.toString(),
        durationMs: Date.now() - startedAt,
        responseStatus: response.status,
        response: body.slice(0, 1000),
      })
    )
  } finally {
    clearTimeout(timeout)
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown cron runner error',
    })
  )
  process.exit(1)
})
