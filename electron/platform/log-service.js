/**
 * @typedef {'info' | 'success' | 'error'} LogLevel
 *
 * @typedef {{
 *   detail: string,
 *   id: number,
 *   level: LogLevel,
 *   message: string,
 *   scope: string,
 *   timestamp: string,
 * }} LogEntry
 *
 * @typedef {{
 *   add: (level: LogLevel, scope: string, message: string, detail?: string) => void,
 *   clear: () => void,
 *   getEntries: () => LogEntry[],
 *   subscribe: (listener: (entries: LogEntry[]) => void) => () => void,
 * }} LogService
 */

const supportedLevels = new Set(['info', 'success', 'error'])

/**
 * Creates the shared in-memory log store used by every KnowledgeWorks window
 * and main-process service.
 *
 * @param {{
 *   getTimestamp?: () => string,
 *   maxEntries?: number,
 * }} [options]
 * @returns {LogService}
 */
export function createLogService({ getTimestamp = getLogTimestamp, maxEntries = 500 } = {}) {
  /** @type {LogEntry[]} */
  const entries = []
  /** @type {Set<(entries: LogEntry[]) => void>} */
  const listeners = new Set()
  let nextId = 1

  function getEntries() {
    return entries.map(entry => ({ ...entry }))
  }

  function publish() {
    const snapshot = getEntries()
    listeners.forEach(listener => listener(snapshot))
  }

  return {
    add(level, scope, message, detail = '') {
      if (!supportedLevels.has(level)) {
        throw new Error(`Unsupported log level: ${level}`)
      }

      entries.push({
        id: nextId,
        timestamp: getTimestamp(),
        level,
        scope,
        message,
        detail,
      })
      nextId += 1

      if (entries.length > maxEntries) {
        entries.splice(0, entries.length - maxEntries)
      }

      publish()
    },

    clear() {
      entries.splice(0)
      publish()
    },

    getEntries,

    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
  }
}

function getLogTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
