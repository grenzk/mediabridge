import { computed, ref } from 'vue'

/**
 * Owns the status, busy, and error state shared by toolbar actions.
 */
export function useToolbarActions() {
  const status = ref('PDF')
  const busyAction = ref('')
  const errorMessage = ref('')

  const isBusy = computed(() => busyAction.value !== '')
  const currentMessage = computed(() => errorMessage.value || status.value)
  const showProgressDots = computed(() => isBusy.value && !errorMessage.value)

  /**
   * Sends renderer-facing errors to the shared log window without masking the
   * toolbar's own fallback error display.
   *
   * @param {string} scope
   * @param {unknown} error
   * @returns {Promise<void>}
   */
  async function writeRendererErrorLog(scope, error) {
    try {
      await window.mediabridge.writeLog(
        'error',
        scope,
        'Renderer received an action error.',
        getErrorMessage(error),
      )
    } catch {
      // Keep toolbar errors visible even if the log bridge itself fails.
    }
  }

  /**
   * Displays an action error in the toolbar and writes its detail to the log.
   *
   * @param {string} scope
   * @param {unknown} error
   * @returns {Promise<void>}
   */
  async function reportActionError(scope, error) {
    await writeRendererErrorLog(scope, error)
    errorMessage.value = 'Needs attention. See logs.'
    status.value = 'Needs attention'
  }

  /**
   * Runs an action while keeping toolbar status and busy state consistent.
   *
   * @param {string} name
   * @param {() => Promise<import('../mediabridge').MediaBridgeActionResult>} action
   * @param {(result: import('../mediabridge').MediaBridgeActionResult) => string} successMessage
   * @param {(result: import('../mediabridge').MediaBridgeActionResult) => void} [updateState]
   * @returns {Promise<void>}
   */
  async function runAction(name, action, successMessage, updateState) {
    busyAction.value = name
    errorMessage.value = ''
    status.value = name

    try {
      const result = await action()

      updateState?.(result)
      status.value = successMessage(result)
    } catch (error) {
      await reportActionError(name, error)
    } finally {
      busyAction.value = ''
    }
  }

  /**
   * Converts an unknown thrown value into readable log text.
   *
   * @param {unknown} error
   * @returns {string}
   */
  function getErrorMessage(error) {
    if (error instanceof Error) {
      return error.message
    }

    return String(error)
  }

  return {
    busyAction,
    currentMessage,
    errorMessage,
    isBusy,
    reportActionError,
    runAction,
    showProgressDots,
    status,
  }
}
