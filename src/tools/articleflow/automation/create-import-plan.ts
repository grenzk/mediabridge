import { readdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'

const supportedArticleExtensions = new Set(['.htm', '.html'])

export type ArticleImportEntry = {
  folderPath: string[]
  relativeSourcePath: string
  sourcePath: string
  title: string
}

export type ArticleImportPlan = {
  articles: ArticleImportEntry[]
  ignoredPaths: string[]
  rootPath: string
}

/**
 * Scans a filesystem taxonomy into an ordered, browser-independent article
 * import plan. The selected root directory is the first eGain folder.
 */
export async function createArticleImportPlan(inputPath: string): Promise<ArticleImportPlan> {
  const rootPath = resolve(inputPath)
  const rootStats = await stat(rootPath)

  if (!rootStats.isDirectory()) {
    throw new Error(`ArticleFlow input must be a directory: ${rootPath}`)
  }

  const articles: ArticleImportEntry[] = []
  const ignoredPaths: string[] = []

  await scanDirectory(rootPath, rootPath, [basename(rootPath)], articles, ignoredPaths)

  return { articles, ignoredPaths, rootPath }
}

async function scanDirectory(
  rootPath: string,
  directoryPath: string,
  folderPath: string[],
  articles: ArticleImportEntry[],
  ignoredPaths: string[],
) {
  const entries = await readdir(directoryPath, { withFileTypes: true })

  entries.sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true }))

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name)
    const relativeEntryPath = relative(rootPath, entryPath)

    if (shouldIgnoreEntry(entry.name)) {
      ignoredPaths.push(relativeEntryPath)
      continue
    }

    if (entry.isDirectory()) {
      await scanDirectory(rootPath, entryPath, [...folderPath, entry.name], articles, ignoredPaths)
      continue
    }

    const extension = extname(entry.name)

    if (!entry.isFile() || !supportedArticleExtensions.has(extension.toLowerCase())) {
      ignoredPaths.push(relativeEntryPath)
      continue
    }

    articles.push({
      folderPath: [...folderPath],
      relativeSourcePath: relativeEntryPath,
      sourcePath: entryPath,
      title: basename(entry.name, extension),
    })
  }
}

function shouldIgnoreEntry(name: string) {
  const normalizedName = name.toLowerCase()

  return name.startsWith('.') || normalizedName === 'desktop.ini' || normalizedName === 'thumbs.db'
}
