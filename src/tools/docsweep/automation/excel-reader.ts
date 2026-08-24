import { readFile } from 'node:fs/promises'
import XLSX from 'xlsx'

export type DocSweepDocument = {
  row: number
  controlNumber: string
}

export type ExcelLoadResult = {
  sheetName: string
  documents: DocSweepDocument[]
}

export async function loadExcelFile(filePath: string): Promise<ExcelLoadResult> {
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

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: '',
  })

  const documents: DocSweepDocument[] = []

  const CONTROL_NUMBER_COLUMN_INDEX = 0
  const FIRST_DATA_ROW_INDEX = 1

  for (let index = FIRST_DATA_ROW_INDEX; index < rows.length; index += 1) {
    const row = rows[index]

    if (!row) {
      continue
    }

    const value = row[CONTROL_NUMBER_COLUMN_INDEX]

    if (value === undefined || value === null || String(value).trim() === '') {
      break
    }

    documents.push({
      row: index + 1,
      controlNumber: String(value).trim(),
    })
  }

  if (documents.length === 0) {
    throw new Error(
      'No control numbers were found in column A starting at row 2.',
    )
  }

  return {
    sheetName,
    documents,
  }
}