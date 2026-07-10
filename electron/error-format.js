/**
 * @param {unknown} error
 * @returns {string}
 */
export function getErrorDetail(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
