import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const { existsSync, getPath, spawn } = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  getPath: vi.fn(() => '/tmp/knowledgeworks-test'),
  spawn: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getPath,
    isPackaged: false,
  },
}))

vi.mock('node:child_process', () => ({ spawn }))
vi.mock('node:fs', () => ({ existsSync }))

const { createBrowserService } = await import('../../../electron/platform/browser-service.js')

/**
 * @returns {EventEmitter & { killed: boolean, kill: ReturnType<typeof vi.fn>, unref: ReturnType<typeof vi.fn> }}
 */
function createBrowserProcess() {
  const browserProcess = new EventEmitter()

  return Object.assign(browserProcess, {
    killed: false,
    kill: vi.fn(),
    unref: vi.fn(),
  })
}

describe('browser service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('deduplicates concurrent launches and publishes connection state', async () => {
    const browserProcess = createBrowserProcess()
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true })

    vi.stubGlobal('fetch', fetch)
    spawn.mockReturnValue(browserProcess)

    const browserService = createBrowserService({
      appRoot: '/project',
      startupTimeout: 1000,
    })
    const states = []
    browserService.subscribe(status => states.push(status.state))

    const firstLaunch = browserService.launch()
    const secondLaunch = browserService.launch()

    expect(secondLaunch).toBe(firstLaunch)
    await expect(firstLaunch).resolves.toBe('http://127.0.0.1:9222')
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(browserProcess.unref).toHaveBeenCalledOnce()
    expect(states).toEqual(['launching', 'connected'])
    expect(browserService.getStatus()).toEqual({ state: 'connected' })
  })

  test('reuses an existing CDP connection without spawning a browser', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'article-page', type: 'page', url: 'https://example.com/article/123' }],
      })
      .mockResolvedValueOnce({ ok: true })

    vi.stubGlobal('fetch', fetch)

    const browserService = createBrowserService({
      appRoot: '/project',
      startupTimeout: 1000,
    })

    await browserService.launch()

    expect(spawn).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:9222/json/activate/article-page')
    expect(browserService.getStatus()).toEqual({ state: 'connected' })
  })
})
