#!/usr/bin/env node

const errors = []
const warnings = []

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)
const isProduction = process.env.NODE_ENV === 'production'
const databaseProvider =
  process.env.DB_PROVIDER ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')

if (nodeMajor < 18) {
  errors.push(`Node.js 18+ is required (detected ${process.versions.node}).`)
}

if (databaseProvider === 'postgres' && !process.env.DATABASE_URL) {
  errors.push('DATABASE_URL is required when DB_PROVIDER=postgres.')
}

if (isProduction && databaseProvider !== 'postgres') {
  errors.push('Production deployments must use Postgres (set DB_PROVIDER=postgres and DATABASE_URL).')
}

if (!process.env.OLLAMA_URL) {
  if (isProduction) {
    errors.push('OLLAMA_URL is required in production.')
  } else {
    warnings.push('OLLAMA_URL is not set; summarization endpoints will fail until configured.')
  }
}

if (!process.env.OLLAMA_MODEL) {
  if (isProduction) {
    errors.push('OLLAMA_MODEL is required in production.')
  } else {
    warnings.push('OLLAMA_MODEL is not set; summarization endpoints will fail until configured.')
  }
}

if (isProduction && !process.env.CRON_SECRET) {
  errors.push('CRON_SECRET is required in production to secure /api/cron/digest.')
}

if (!process.env.RSS_FEEDS) {
  warnings.push('RSS_FEEDS is not set; configure feeds in the Settings UI after startup.')
}

if (errors.length > 0) {
  console.error('❌ Environment validation failed:')
  for (const error of errors) {
    console.error(` - ${error}`)
  }
  process.exit(1)
}

if (warnings.length > 0) {
  console.warn('⚠️  Environment validation warnings:')
  for (const warning of warnings) {
    console.warn(` - ${warning}`)
  }
}

console.log(
  `✅ Environment validation passed (provider=${databaseProvider}, node=${process.versions.node}).`
)
