import { describe, expect, test, vi } from 'vitest'
import { createLogService } from '../../electron/log-service.js'

describe('log service', () => {
  test('stores entries with stable IDs and timestamps', () => {
    const logService = createLogService({
      getTimestamp: () => '12:34:56',
    })

    logService.add('info', 'App', 'KnowledgeWorks started.')
    logService.add('success', 'Browser', 'Connected.', 'CDP is ready.')

    expect(logService.getEntries()).toEqual([
      {
        id: 1,
        timestamp: '12:34:56',
        level: 'info',
        scope: 'App',
        message: 'KnowledgeWorks started.',
        detail: '',
      },
      {
        id: 2,
        timestamp: '12:34:56',
        level: 'success',
        scope: 'Browser',
        message: 'Connected.',
        detail: 'CDP is ready.',
      },
    ])
  })

  test('retains only the configured number of entries', () => {
    const logService = createLogService({
      getTimestamp: () => '12:34:56',
      maxEntries: 2,
    })

    logService.add('info', 'Test', 'First')
    logService.add('info', 'Test', 'Second')
    logService.add('info', 'Test', 'Third')

    expect(logService.getEntries().map(entry => entry.message)).toEqual(['Second', 'Third'])
  })

  test('publishes detached snapshots and stops after unsubscribe', () => {
    const logService = createLogService({
      getTimestamp: () => '12:34:56',
    })
    const listener = vi.fn()
    const unsubscribe = logService.subscribe(listener)

    logService.add('error', 'Linking', 'Could not find a file.')
    const publishedEntries = listener.mock.calls[0][0]
    publishedEntries[0].message = 'Changed outside the service'

    expect(logService.getEntries()[0].message).toBe('Could not find a file.')

    logService.clear()
    expect(listener).toHaveBeenLastCalledWith([])

    unsubscribe()
    logService.add('info', 'App', 'New entry')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('rejects unsupported log levels', () => {
    const logService = createLogService()

    expect(() => logService.add('debug', 'Test', 'Unsupported')).toThrow('Unsupported log level: debug')
  })
})
