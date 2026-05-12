import 'dotenv/config'
import { connectToBrowser } from '../browser.js'

const { CDP_URL } = process.env

const { browser, context, pages } = await connectToBrowser(CDP_URL)

