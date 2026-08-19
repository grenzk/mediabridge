import { computed, ref } from 'vue'
import type { MediaBridgeActionResult, MediaBridgeLinkingMode } from '../../../../shared/types/knowledgeworks'
import type { ToolbarActions } from './useToolbarActions.ts'

type LinkingTypeConfig = {
  disabled?: boolean
  label: string
  statusLabel: string
}

type LinkingOption = {
  disabled: boolean
  label: string
  value: MediaBridgeLinkingMode
}

const linkingTypes: Record<MediaBridgeLinkingMode, LinkingTypeConfig> = {
  pdf: { label: 'PDF', statusLabel: 'PDF' },
  word: { label: 'Word', statusLabel: 'Word' },
  excel: { label: 'Excel', statusLabel: 'Excel' },
  powerpoint: { label: 'PowerPoint', statusLabel: 'PowerPoint' },
  image: { label: 'Image', statusLabel: 'Image' },
  article: { label: 'Article', statusLabel: 'Article' },
}
const linkingModes = Object.keys(linkingTypes) as MediaBridgeLinkingMode[]

/**
 * Owns linking mode selection, counts, and automation actions.
 */
export function useMediaLinking({ errorMessage, isBusy, runAction, status }: ToolbarActions) {
  const targetCount = ref<number | null>(null)
  const unlinkedTargetCount = ref<number | null>(null)
  const linkedTargetCount = ref<number | null>(null)
  const processedTargetCount = ref<number | null>(null)
  const selectedLinkingType = ref<MediaBridgeLinkingMode>('pdf')
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
   */
  function updateCounts(result: MediaBridgeActionResult) {
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
   */
  function chooseLinkingType(option: LinkingOption) {
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
