// Progress tracking for newsletter analysis
// Stores in-memory progress for active analysis sessions

interface AnalysisProgress {
  userId: string
  total: number
  completed: number
  currentNewsletter: string
  startTime: number
  estimatedTimePerNewsletter: number // in milliseconds
}

const progressStore = new Map<string, AnalysisProgress>()

export function startProgress(userId: string, total: number, avgTimeMs: number = 20000) {
  progressStore.set(userId, {
    userId,
    total,
    completed: 0,
    currentNewsletter: '',
    startTime: Date.now(),
    estimatedTimePerNewsletter: avgTimeMs,
  })
}

export function updateProgress(userId: string, completed: number, currentNewsletter: string) {
  const progress = progressStore.get(userId)
  if (progress) {
    progress.completed = completed
    progress.currentNewsletter = currentNewsletter
    progressStore.set(userId, progress)
  }
}

export function getProgress(userId: string): AnalysisProgress | null {
  return progressStore.get(userId) || null
}

export function clearProgress(userId: string) {
  progressStore.delete(userId)
}

export function getProgressPercentage(userId: string): number {
  const progress = progressStore.get(userId)
  if (!progress || progress.total === 0) return 0
  return Math.round((progress.completed / progress.total) * 100)
}

export function getEstimatedTimeRemaining(userId: string): number {
  const progress = progressStore.get(userId)
  if (!progress) return 0
  
  const remaining = progress.total - progress.completed
  return remaining * progress.estimatedTimePerNewsletter
}
