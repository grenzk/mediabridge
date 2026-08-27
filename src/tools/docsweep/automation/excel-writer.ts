import ExcelJS from 'exceljs'
import type { DocSweepDocument } from './excel-reader.ts'

const MASW_COLUMN = 5
const VERTIV_COLUMN = 6
const ASSET_LIBRARY_COLUMN = 7
const PD_CLOUD_COLUMN = 8

export async function saveExcelResults(filePath: string, documents: DocSweepDocument[]): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.readFile(filePath)

  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('The Excel workbook does not contain any worksheets.')
  }

  for (const document of documents) {
    const row = worksheet.getRow(document.row)

    row.getCell(MASW_COLUMN).value = document.masw
    row.getCell(VERTIV_COLUMN).value = document.vertiv
    row.getCell(ASSET_LIBRARY_COLUMN).value = document.assetLibrary
    row.getCell(PD_CLOUD_COLUMN).value = document.pdCloud
  }

  await workbook.xlsx.writeFile(filePath)
}
