import 'dotenv/config'
import { getDefaultCdpUrl } from '../../../shared/config/runtime.ts'
import { runMediaLinkingFromCdp } from '../automation/media-linking.ts'

const { LINKING_MODE = 'pdf' } = process.env

const result = await runMediaLinkingFromCdp(getDefaultCdpUrl(), LINKING_MODE)
console.log(
  `Processed ${result.processedCount} ${result.mode.label} target(s) out of ${result.unlinkedTargetCount} matching target(s).`,
)
