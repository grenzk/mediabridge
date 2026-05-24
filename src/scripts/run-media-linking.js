import 'dotenv/config'
import { runMediaLinkingFromCdp } from '../automation/media-linking.js'

const { CDP_URL, LINKING_MODE = 'pdf' } = process.env

if (!CDP_URL) {
  throw new Error('CDP_URL is required.')
}

const result = await runMediaLinkingFromCdp(CDP_URL, LINKING_MODE)
console.log(
  `Processed ${result.processedCount} ${result.mode.label} links out of ${result.documentLinks.length} matching links.`,
)
