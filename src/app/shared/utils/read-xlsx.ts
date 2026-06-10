import * as XLSX from 'xlsx';

/** Read first worksheet from a bank statement .xlsx export. */
export async function readStatementXlsx(file: File): Promise<unknown[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Spreadsheet has no worksheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
}
