import 'dotenv/config'
import { runMediaLinkingFromCdp } from '../automation/media-linking.js'
import { getDefaultCdpUrl } from '../config/runtime.js'

const { LINKING_MODE = 'pdf' } = process.env

const result = await runMediaLinkingFromCdp(getDefaultCdpUrl(), LINKING_MODE)
console.log(
  `Processed ${result.processedCount} ${result.mode.label} links out of ${result.documentLinks.length} matching links.`,
)
