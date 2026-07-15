import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
	MAX_QUOTATION_IMPORT_ROWS,
	QuotationXlsxImportError,
	parseQuotationWorkbook,
	parseQuotationXlsxFile,
	suggestQuotationColumnMapping
} from './xlsx-parser';

function workbookBuffer(sheets: Record<string, unknown[][]>): ArrayBuffer {
	const workbook = XLSX.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
	}
	const output = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
	return output instanceof ArrayBuffer ? output : new Uint8Array(output).buffer;
}

describe('quotation XLSX parser', () => {
	it('selects the first importable sheet, skips empty sheets and ignores summary formulas', () => {
		const buffer = workbookBuffer({
			Arkusz1: [
				['Oferta monitoringu'],
				['Lp.', 'Pozycja', 'szt.', 'Cena brutto', 'Wartość brutto'],
				[1, 'Kamera IP', 3, 1250, { f: 'C3*D3', v: 1 }],
				[3, 'Rejestrator', 1, '2 500,00 zł', { f: 'C4*D4', v: 999999 }],
				['', 'RAZEM', '', '', { f: 'SUM(E3:E4)', v: 1 }]
			],
			Arkusz2: [],
			Arkusz3: []
		});

		const result = parseQuotationWorkbook(buffer);

		expect(result.selectedSheetName).toBe('Arkusz1');
		expect(result.headerRowNumber).toBe(2);
		expect(result.sheets).toEqual([{ name: 'Arkusz1', nonEmptyRowCount: 5, canImport: true }]);
		expect(result.items).toEqual([
			expect.objectContaining({
				id: 'xlsx-row-3',
				name: 'Kamera IP',
				quantity: 3,
				unit: 'szt.',
				unitGrossCents: 125000,
				totalGrossCents: 375000,
				sortOrder: 0
			}),
			expect.objectContaining({
				id: 'xlsx-row-4',
				name: 'Rejestrator',
				unitGrossCents: 250000,
				totalGrossCents: 250000,
				sortOrder: 1
			})
		]);
		expect(result.totalGrossCents).toBe(625000);
		expect(result.issues).toEqual([]);
	});

	it('supports manual mapping and optional quotation fields', () => {
		const buffer = workbookBuffer({
			Dane: [
				['Produkt', 'Liczba', 'Net irrelevant', 'Brutto', 'J.m.', 'Opis', 'Grupa'],
				['Przewód UTP', '12,5', 0, '3,99', 'm', 'kat. 6', 'Materiały']
			]
		});

		const result = parseQuotationWorkbook(buffer, {
			mapping: {
				name: 0,
				quantity: 1,
				unitGross: 3,
				unit: 4,
				shortDescription: 5,
				category: 6
			}
		});

		expect(result.items[0]).toMatchObject({
			name: 'Przewód UTP',
			shortDescription: 'kat. 6',
			quantity: 12.5,
			unit: 'm',
			unitGrossCents: 399,
			totalGrossCents: 4988,
			categoryTitle: 'Materiały'
		});
	});

	it('reports invalid data rows without importing partial invalid items', () => {
		const buffer = workbookBuffer({
			Dane: [
				['Nazwa', 'Ilość', 'Cena jednostkowa brutto'],
				['Poprawna', 1, 10],
				['Za dużo miejsc', '1,2345', 20],
				['Cena ujemna', 1, -5],
				['', 2, 100]
			]
		});

		const result = parseQuotationWorkbook(buffer);

		expect(result.items).toHaveLength(1);
		expect(result.issues).toEqual([
			expect.objectContaining({ rowNumber: 3, field: 'quantity' }),
			expect.objectContaining({ rowNumber: 4, field: 'unitGross' }),
			expect.objectContaining({ rowNumber: 5, field: 'name' })
		]);
	});

	it('allows choosing another importable sheet', () => {
		const buffer = workbookBuffer({
			Pierwszy: [
				['Nazwa', 'Ilość', 'Cena brutto'],
				['A', 1, 10]
			],
			Drugi: [
				['Nazwa', 'Ilość', 'Cena brutto'],
				['B', 2, 20]
			]
		});

		const result = parseQuotationWorkbook(buffer, { sheetName: 'Drugi' });

		expect(result.selectedSheetName).toBe('Drugi');
		expect(result.items[0].name).toBe('B');
		expect(result.sheets).toHaveLength(2);
	});

	it('suggests columns using Polish header variants', () => {
		expect(
			suggestQuotationColumnMapping([
				'Lp.',
				'Nazwa pozycji',
				'Ilość',
				'Cena jedn. brutto',
				'Wartość brutto'
			])
		).toEqual({ name: 1, quantity: 2, unitGross: 3, comparisonTotalGross: 4 });
	});

	it('rejects unsupported files before reading their contents', async () => {
		const arrayBuffer = async () => workbookBuffer({ Dane: [] });

		await expect(
			parseQuotationXlsxFile({ name: 'oferta.xls', size: 10, arrayBuffer })
		).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' });
		await expect(
			parseQuotationXlsxFile({ name: 'oferta.xlsx', size: 5 * 1024 * 1024 + 1, arrayBuffer })
		).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
	});

	it('enforces the 500-row MVP limit', () => {
		const rows = [
			['Nazwa', 'Ilość', 'Cena brutto'],
			...Array.from({ length: MAX_QUOTATION_IMPORT_ROWS + 1 }, (_, index) => [
				`Pozycja ${index + 1}`,
				1,
				1
			])
		];

		expect(() => parseQuotationWorkbook(workbookBuffer({ Dane: rows }))).toThrowError(
			QuotationXlsxImportError
		);
		try {
			parseQuotationWorkbook(workbookBuffer({ Dane: rows }));
		} catch (error) {
			expect(error).toMatchObject({ code: 'TOO_MANY_ROWS' });
		}
	});
});
