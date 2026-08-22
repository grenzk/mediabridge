import { describe, expect, it } from 'vitest'
import {
  AutomationCancellationError,
  isAutomationCancellationError,
  throwIfAutomationCancelled,
} from '../../src/shared/automation/cancellation.ts'

describe('automation cancellation', () => {
  it('does nothing while the automation remains active', () => {
    const controller = new AbortController()

    expect(() => throwIfAutomationCancelled(controller.signal)).not.toThrow()
  })

  it('throws a distinguishable error after cancellation', () => {
    const controller = new AbortController()

    controller.abort()

    expect(() => throwIfAutomationCancelled(controller.signal)).toThrow(AutomationCancellationError)

    try {
      throwIfAutomationCancelled(controller.signal)
    } catch (error) {
      expect(isAutomationCancellationError(error)).toBe(true)
    }
  })
})
