import ExcelJS from 'exceljs';

export async function loadExcelContentData() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('./data/ExcelwebAsociaciones.xlsx');

    // Lee la pestaña 1 del fichero excel
    const worksheet = workbook.getWorksheet(1);

    const headers = worksheet.getRow(1).values.slice(1);
    const data = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const obj = {};

        headers.forEach((header, index) => {
        obj[header] = row.getCell(index + 1).value;
        });

        data.push(obj);
    });

    return data

}