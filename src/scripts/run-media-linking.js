import 'dotenv/config'
import { runMediaLinkingFromCdp } from '../automation/media-linking.js'

const { CDP_URL } = process.env

if (!CDP_URL) {
  throw new Error('CDP_URL is required.')
}

const result = await runMediaLinkingFromCdp(CDP_URL)
console.log(
  `Processed ${result.processedCount} PDF links out of ${result.pdfLinks.length} PDF links.`,
)
