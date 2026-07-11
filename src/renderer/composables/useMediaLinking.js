import { computed, ref } from 'vue'

/**
 * @typedef {{
 *   disabled?: boolean,
 *   label: string,
 *   statusLabel: string,
 * }} LinkingTypeConfig
 *
 * @typedef {{
 *   disabled: boolean,
 *   label: string,
 *   value: import('../mediabridge').MediaBridgeLinkingMode,
 * }} LinkingOption
 *
 * @typedef {{
 *   isBusy: import('vue').ComputedRef<boolean>,
 *   errorMessage: import('vue').Ref<string>,
 *   runAction: (
 *     name: string,
 *     action: () => Promise<import('../mediabridge').MediaBridgeActionResult>,
 *     successMessage: (result: import('../mediabridge').MediaBridgeActionResult) => string,
 *     updateState?: (result: import('../mediabridge').MediaBridgeActionResult) => void,
 *   ) => Promise<void>,
 *   status: import('vue').Ref<string>,
 * }} ToolbarActions
 */

/** @type {Record<import('../mediabridge').MediaBridgeLinkingMode, LinkingTypeConfig>} */
const linkingTypes = {
  pdf: { label: 'PDF', statusLabel: 'PDF' },
  word: { label: 'Word', statusLabel: 'Word' },
  excel: { label: 'Excel', statusLabel: 'Excel' },
  image: { label: 'Image', statusLabel: 'Image' },
  article: { label: 'Article', statusLabel: 'Article' },
}
const linkingModes = /** @type {import('../mediabridge').MediaBridgeLinkingMode[]} */ (Object.keys(linkingTypes))

/**
 * Owns linking mode selection, counts, and automation actions.
 *
 * @param {ToolbarActions} toolbarActions
 */
export function useMediaLinking({ errorMessage, isBusy, runAction, status }) {
  /** @type {import('vue').Ref<null | number>} */
  const linkCount = ref(null)
  /** @type {import('vue').Ref<null | number>} */
  const documentCount = ref(null)
  /** @type {import('vue').Ref<null | number>} */
  const doneCount = ref(null)
  /** @type {import('vue').Ref<import('../mediabridge').MediaBridgeLinkingMode>} */
  const selectedLinkingType = ref('pdf')
  const isLinkingTypeMenuOpen = ref(false)

  const linkLabel = computed(() => {
    if (selectedLinkingType.value === 'image') {
      return linkCount.value === 1 ? 'Image' : 'Images'
    }

    return linkCount.value === 1 ? 'Link' : 'Links'
  })
  const selectedLinkingTypeConfig = computed(() => linkingTypes[selectedLinkingType.value])
  const selectedTargetLabel = computed(() => (selectedLinkingType.value === 'image' ? 'images' : 'links'))
  const selectedCountLabel = computed(() => (selectedLinkingType.value === 'image' ? 'image' : 'link'))
  const linkingOptions = computed(() =>
    linkingModes.map(value => {
      const linkingType = linkingTypes[value]

      return {
        disabled: linkingType.disabled ?? false,
        value,
        label: linkingType.label,
      }
    }),
  )

  function closeLinkingTypeMenu() {
    isLinkingTypeMenuOpen.value = false
  }

  function resetCounts() {
    linkCount.value = null
    documentCount.value = null
    doneCount.value = null
  }

  /**
   * Applies count fields returned by count and linking actions.
   *
   * @param {import('../mediabridge').MediaBridgeActionResult} result
   */
  function updateCounts(result) {
    if (result.count !== undefined) {
      linkCount.value = result.count
    }

    if (result.documentCount !== undefined) {
      documentCount.value = result.documentCount
    }

    if (result.processedCount !== undefined) {
      doneCount.value = result.processedCount
    }

    if (result.linkedCount !== undefined) {
      doneCount.value = result.linkedCount
    }
  }

  /** @returns {Promise<void>} */
  function refreshLinkCount() {
    resetCounts()
    closeLinkingTypeMenu()

    return runAction(
      `Counting ${selectedTargetLabel.value}`,
      () => window.mediabridge.getLinkCount(selectedLinkingType.value),
      result => {
        const noun =
          selectedLinkingType.value === 'image'
            ? result.documentCount === 1
              ? 'image'
              : 'images'
            : `${result.mode} ${result.documentCount === 1 ? 'link' : 'links'}`

        return `${result.documentCount} ${noun} ready`
      },
      updateCounts,
    )
  }

  /** @returns {Promise<void>} */
  function runMediaLinking() {
    closeLinkingTypeMenu()

    return runAction(
      'Running script',
      () => window.mediabridge.runMediaLinking(selectedLinkingType.value),
      result => {
        const noun =
          selectedLinkingType.value === 'image'
            ? result.processedCount === 1
              ? 'image'
              : 'images'
            : `${result.mode} ${result.processedCount === 1 ? 'link' : 'links'}`
        const skippedText = result.skippedCount ? `, skipped ${result.skippedCount} missing` : ''

        return `Inserted ${result.processedCount} ${noun}${skippedText}`
      },
      updateCounts,
    )
  }

  function toggleLinkingTypeMenu() {
    if (!isBusy.value) {
      isLinkingTypeMenuOpen.value = !isLinkingTypeMenuOpen.value
    }
  }

  /**
   * Selects a linking mode and resets its display state.
   *
   * @param {LinkingOption} option
   */
  function chooseLinkingType(option) {
    if (option.disabled) {
      return
    }

    selectedLinkingType.value = option.value
    closeLinkingTypeMenu()
    status.value = selectedLinkingTypeConfig.value.statusLabel
    errorMessage.value = ''
    resetCounts()
  }

  return {
    chooseLinkingType,
    closeLinkingTypeMenu,
    documentCount,
    doneCount,
    isLinkingTypeMenuOpen,
    linkCount,
    linkLabel,
    linkingOptions,
    refreshLinkCount,
    runMediaLinking,
    selectedCountLabel,
    selectedLinkingType,
    selectedLinkingTypeConfig,
    toggleLinkingTypeMenu,
  }
}
