import ExcelJS from 'exceljs'
import type { DocSweepDocument } from './excel-reader.ts'

const MASW_COLUMN = 5
const VERTIV_COLUMN = 6
const ASSET_LIBRARY_COLUMN = 7
const PD_CLOUD_COLUMN = 8

export async function saveExcelResults(
  sourceFilePath: string,
  documents: DocSweepDocument[],
  outputFilePath = sourceFilePath,
): Promise<void> {
  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.readFile(sourceFilePath)

  if (workbook.worksheets.length === 0) {
    throw new Error('The Excel workbook does not contain any worksheets.')
  }

  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('Unable to determine the worksheet.')
  }

  for (const document of documents) {
    worksheet.getCell(document.row, MASW_COLUMN).value = document.masw

    worksheet.getCell(document.row, VERTIV_COLUMN).value = document.vertiv

    worksheet.getCell(document.row, ASSET_LIBRARY_COLUMN).value = document.assetLibrary

    worksheet.getCell(document.row, PD_CLOUD_COLUMN).value = document.pdCloud
  }

  await workbook.xlsx.writeFile(outputFilePath)
}
