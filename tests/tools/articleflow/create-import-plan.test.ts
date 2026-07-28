import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createArticleImportPlan } from '../../../src/tools/articleflow/automation/create-import-plan.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('createArticleImportPlan', () => {
  it('creates ordered article entries from a filesystem taxonomy', async () => {
    const rootPath = await createTemporaryDirectory('Sample Product')
    const manualsPath = join(rootPath, '[001]Product Information', '[004]Manuals')

    await mkdir(manualsPath, { recursive: true })
    await writeFile(join(manualsPath, 'Manuals.htm'), '<p>Manuals</p>')
    await writeFile(join(manualsPath, 'Specifications.HTML'), '<p>Specifications</p>')
    await writeFile(join(manualsPath, 'Notes.txt'), 'Not an article')
    await writeFile(join(rootPath, '.DS_Store'), 'metadata')

    const plan = await createArticleImportPlan(rootPath)

    expect(plan.articles).toEqual([
      {
        folderPath: ['Sample Product', '[001]Product Information', '[004]Manuals'],
        relativeSourcePath: join('[001]Product Information', '[004]Manuals', 'Manuals.htm'),
        sourcePath: join(manualsPath, 'Manuals.htm'),
        title: 'Manuals',
      },
      {
        folderPath: ['Sample Product', '[001]Product Information', '[004]Manuals'],
        relativeSourcePath: join('[001]Product Information', '[004]Manuals', 'Specifications.HTML'),
        sourcePath: join(manualsPath, 'Specifications.HTML'),
        title: 'Specifications',
      },
    ])
    expect(plan.ignoredPaths).toEqual(['.DS_Store', join('[001]Product Information', '[004]Manuals', 'Notes.txt')])
  })

  it('does not traverse hidden directories', async () => {
    const rootPath = await createTemporaryDirectory('Sample Product')
    const hiddenDirectory = join(rootPath, '.archive')

    await mkdir(hiddenDirectory)
    await writeFile(join(hiddenDirectory, 'Archived.htm'), '<p>Archived</p>')

    const plan = await createArticleImportPlan(rootPath)

    expect(plan.articles).toEqual([])
    expect(plan.ignoredPaths).toEqual(['.archive'])
  })

  it('rejects a file as the taxonomy root', async () => {
    const temporaryDirectory = await createTemporaryDirectory('articleflow')
    const filePath = join(temporaryDirectory, 'Article.htm')

    await writeFile(filePath, '<p>Article</p>')

    await expect(createArticleImportPlan(filePath)).rejects.toThrow(
      `ArticleFlow input must be a directory: ${filePath}`,
    )
  })
})

async function createTemporaryDirectory(name: string) {
  const parentDirectory = await mkdtemp(join(tmpdir(), 'articleflow-'))
  const directory = join(parentDirectory, name)

  temporaryDirectories.push(parentDirectory)
  await mkdir(directory)

  return directory
}
