// Analysis lock to prevent duplicate analyses
const analysisLocks = new Map<string, boolean>()

export function isAnalysisInProgress(userId: string): boolean {
  return analysisLocks.get(userId) === true
}

export function lockAnalysis(userId: string): boolean {
  if (analysisLocks.get(userId)) {
    return false // Already locked
  }
  analysisLocks.set(userId, true)
  return true // Successfully locked
}

export function unlockAnalysis(userId: string) {
  analysisLocks.delete(userId)
}
