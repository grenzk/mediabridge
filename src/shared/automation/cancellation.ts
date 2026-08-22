export class AutomationCancellationError extends Error {
  constructor() {
    super('Automation stopped by user.')
    this.name = 'AutomationCancellationError'
  }
}

export function throwIfAutomationCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AutomationCancellationError()
  }
}

export function isAutomationCancellationError(error: unknown): error is AutomationCancellationError {
  return error instanceof AutomationCancellationError
}
