import ExcelJS from 'exceljs'

export type DocSweepDocument = {
  row: number
  controlNumber: string
  masw: string
  vertiv: string
  assetLibrary: string
  pdCloud: string
}

export type ExcelLoadResult = {
  sheetName: string
  documents: DocSweepDocument[]
}

export async function loadExcelFile(filePath: string): Promise<ExcelLoadResult> {
  const workbook = new ExcelJS.Workbook()

  await workbook.xlsx.readFile(filePath)

  if (workbook.worksheets.length === 0) {
    throw new Error('The Excel workbook does not contain any worksheets.')
  }

  const worksheet = workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('Unable to determine the worksheet.')
  }

  const documents: DocSweepDocument[] = []

  const CONTROL_NUMBER_COLUMN = 1
  const MASW_COLUMN = 5
  const VERTIV_COLUMN = 6
  const ASSET_LIBRARY_COLUMN = 7
  const PD_CLOUD_COLUMN = 8
  const FIRST_DATA_ROW = 2

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)

    const value = row.getCell(CONTROL_NUMBER_COLUMN).value

    if (value === undefined || value === null || String(value).trim() === '') {
      continue
    }

    documents.push({
      row: rowNumber,
      controlNumber: String(value).trim(),
      masw: String(row.getCell(MASW_COLUMN).value ?? '').trim(),
      vertiv: String(row.getCell(VERTIV_COLUMN).value ?? '').trim(),
      assetLibrary: String(row.getCell(ASSET_LIBRARY_COLUMN).value ?? '').trim(),
      pdCloud: String(row.getCell(PD_CLOUD_COLUMN).value ?? '').trim(),
    })
  }

  if (documents.length === 0) {
    throw new Error('No control numbers were found in column A starting at row 2.')
  }

  return {
    sheetName: worksheet.name,
    documents,
  }
}
