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
  powerpoint: { label: 'PowerPoint', statusLabel: 'PowerPoint' },
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
  const targetCount = ref(null)
  /** @type {import('vue').Ref<null | number>} */
  const unlinkedTargetCount = ref(null)
  /** @type {import('vue').Ref<null | number>} */
  const linkedTargetCount = ref(null)
  /** @type {import('vue').Ref<null | number>} */
  const processedTargetCount = ref(null)
  /** @type {import('vue').Ref<import('../mediabridge').MediaBridgeLinkingMode>} */
  const selectedLinkingType = ref('pdf')
  const isLinkingTypeMenuOpen = ref(false)

  const targetLabel = computed(() => {
    if (selectedLinkingType.value === 'image') {
      return targetCount.value === 1 ? 'Image' : 'Images'
    }

    return targetCount.value === 1 ? 'Link' : 'Links'
  })
  const doneTargetCount = computed(() => processedTargetCount.value ?? linkedTargetCount.value)
  const selectedLinkingTypeConfig = computed(() => linkingTypes[selectedLinkingType.value])
  const targetPluralLabel = computed(() => (selectedLinkingType.value === 'image' ? 'images' : 'links'))
  const targetSingularLabel = computed(() => (selectedLinkingType.value === 'image' ? 'image' : 'link'))
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
    targetCount.value = null
    unlinkedTargetCount.value = null
    linkedTargetCount.value = null
    processedTargetCount.value = null
  }

  /**
   * Applies count fields returned by count and linking actions.
   *
   * @param {import('../mediabridge').MediaBridgeActionResult} result
   */
  function updateCounts(result) {
    if (result.targetCount !== undefined) {
      targetCount.value = result.targetCount
    }

    if (result.unlinkedTargetCount !== undefined) {
      unlinkedTargetCount.value = result.unlinkedTargetCount
    }

    if (result.processedCount !== undefined) {
      processedTargetCount.value = result.processedCount
    }

    if (result.linkedTargetCount !== undefined) {
      linkedTargetCount.value = result.linkedTargetCount
    }
  }

  /** @returns {Promise<void>} */
  function refreshTargetCount() {
    resetCounts()
    closeLinkingTypeMenu()

    return runAction(
      `Counting ${targetPluralLabel.value}`,
      () => window.mediabridge.getTargetCount(selectedLinkingType.value),
      result => {
        const noun =
          selectedLinkingType.value === 'image'
            ? result.unlinkedTargetCount === 1
              ? 'image'
              : 'images'
            : `${result.mode} ${result.unlinkedTargetCount === 1 ? 'link' : 'links'}`

        return `${result.unlinkedTargetCount} ${noun} ready`
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
    doneTargetCount,
    isLinkingTypeMenuOpen,
    linkingOptions,
    refreshTargetCount,
    runMediaLinking,
    selectedLinkingType,
    selectedLinkingTypeConfig,
    targetCount,
    targetLabel,
    targetSingularLabel,
    toggleLinkingTypeMenu,
    unlinkedTargetCount,
  }
}
