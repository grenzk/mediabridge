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
  const FIRST_DATA_ROW = 2

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)

    const value = row.getCell(CONTROL_NUMBER_COLUMN).value

    if (value === undefined || value === null || String(value).trim() === '') {
      break
    }

    documents.push({
      row: rowNumber,
      controlNumber: String(value).trim(),
      masw: '',
      vertiv: '',
      assetLibrary: '',
      pdCloud: '',
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
