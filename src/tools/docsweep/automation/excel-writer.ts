import { readFile, writeFile } from 'node:fs/promises'
import XLSX from 'xlsx'
import type { DocSweepDocument } from './excel-reader.ts'

const MASW_COLUMN = 5
const VERTIV_COLUMN = 6
const ASSET_LIBRARY_COLUMN = 7
const PD_CLOUD_COLUMN = 8

export async function saveExcelResults(filePath: string, documents: DocSweepDocument[]): Promise<void> {
  const fileBuffer = await readFile(filePath)

  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
  })

  if (workbook.SheetNames.length === 0) {
    throw new Error('The Excel workbook does not contain any worksheets.')
  }

  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('Unable to determine the worksheet name.')
  }

  const worksheet = workbook.Sheets[sheetName]

  if (!worksheet) {
    throw new Error(`Unable to read worksheet "${sheetName}".`)
  }

  for (const document of documents) {
    worksheet[
      XLSX.utils.encode_cell({
        r: document.row - 1,
        c: MASW_COLUMN - 1,
      })
    ] = {
      t: 's',
      v: document.masw,
    }

    worksheet[
      XLSX.utils.encode_cell({
        r: document.row - 1,
        c: VERTIV_COLUMN - 1,
      })
    ] = {
      t: 's',
      v: document.vertiv,
    }

    worksheet[
      XLSX.utils.encode_cell({
        r: document.row - 1,
        c: ASSET_LIBRARY_COLUMN - 1,
      })
    ] = {
      t: 's',
      v: document.assetLibrary,
    }

    worksheet[
      XLSX.utils.encode_cell({
        r: document.row - 1,
        c: PD_CLOUD_COLUMN - 1,
      })
    ] = {
      t: 's',
      v: document.pdCloud,
    }
  }

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
  })

  await writeFile(filePath, output)
}
