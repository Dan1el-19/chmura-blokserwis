import * as XLSX from 'xlsx';
import type {
	ImportedQuotationItem,
	QuotationColumnMapping,
	QuotationImportField,
	QuotationImportIssue,
	QuotationSheetSummary,
	QuotationWorkbookImport
} from './types';

export const MAX_QUOTATION_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_QUOTATION_IMPORT_ROWS = 500;

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRows = CellValue[][];

interface DetectedHeader {
	rowIndex: number;
	headers: string[];
	mapping: QuotationColumnMapping;
	score: number;
}

export interface ParseQuotationWorkbookOptions {
	sheetName?: string;
	mapping?: QuotationColumnMapping;
}

const HEADER_ALIASES: Record<QuotationImportField, string[]> = {
	name: ['nazwa', 'pozycja', 'nazwa pozycji', 'towar usluga', 'element', 'produkt usluga'],
	quantity: ['ilosc', 'szt', 'liczba', 'qty'],
	unitGross: [
		'cena brutto',
		'cena jednostkowa',
		'cena jednostkowa brutto',
		'cena jedn',
		'cena jedn brutto',
		'cena'
	],
	shortDescription: ['opis', 'opis pozycji', 'opis krotki', 'krotki opis'],
	unit: ['jednostka', 'j m', 'jm'],
	category: ['kategoria', 'grupa', 'dzial'],
	comparisonTotalGross: ['wartosc brutto', 'wartosc', 'razem brutto', 'suma brutto']
};

const REQUIRED_FIELDS: QuotationImportField[] = ['name', 'quantity', 'unitGross'];

export class QuotationXlsxImportError extends Error {
	constructor(
		message: string,
		public readonly code:
			| 'INVALID_FILE_TYPE'
			| 'FILE_TOO_LARGE'
			| 'INVALID_WORKBOOK'
			| 'SHEET_NOT_FOUND'
			| 'HEADER_NOT_FOUND'
			| 'TOO_MANY_ROWS'
	) {
		super(message);
		this.name = 'QuotationXlsxImportError';
	}
}

export async function parseQuotationXlsxFile(
	file: Pick<File, 'name' | 'size' | 'arrayBuffer'>,
	options: ParseQuotationWorkbookOptions = {}
): Promise<QuotationWorkbookImport> {
	if (!file.name.toLocaleLowerCase('pl-PL').endsWith('.xlsx')) {
		throw new QuotationXlsxImportError('Obsługiwane są wyłącznie pliki XLSX.', 'INVALID_FILE_TYPE');
	}

	if (file.size > MAX_QUOTATION_XLSX_BYTES) {
		throw new QuotationXlsxImportError('Plik XLSX może mieć maksymalnie 5 MB.', 'FILE_TOO_LARGE');
	}

	return parseQuotationWorkbook(await file.arrayBuffer(), options);
}

export function parseQuotationWorkbook(
	data: ArrayBuffer,
	options: ParseQuotationWorkbookOptions = {}
): QuotationWorkbookImport {
	if (data.byteLength > MAX_QUOTATION_XLSX_BYTES) {
		throw new QuotationXlsxImportError('Plik XLSX może mieć maksymalnie 5 MB.', 'FILE_TOO_LARGE');
	}

	let workbook: XLSX.WorkBook;
	try {
		workbook = XLSX.read(new Uint8Array(data), {
			type: 'array',
			cellFormula: true,
			cellDates: true
		});
	} catch {
		throw new QuotationXlsxImportError('Nie udało się odczytać pliku XLSX.', 'INVALID_WORKBOOK');
	}

	const analyzedSheets = workbook.SheetNames.map((name) => {
		const rows = sheetToRows(workbook.Sheets[name]);
		return { name, rows, header: detectHeader(rows) };
	});
	const sheets: QuotationSheetSummary[] = analyzedSheets
		.map(({ name, rows, header }) => ({
			name,
			nonEmptyRowCount: rows.filter(isNonEmptyRow).length,
			canImport: header !== null
		}))
		.filter((sheet) => sheet.nonEmptyRowCount > 0);

	if (sheets.length === 0) {
		throw new QuotationXlsxImportError('Skoroszyt nie zawiera danych.', 'INVALID_WORKBOOK');
	}

	const selected = options.sheetName
		? analyzedSheets.find((sheet) => sheet.name === options.sheetName)
		: options.mapping
			? analyzedSheets.find((sheet) => sheet.rows.some(isNonEmptyRow))
			: analyzedSheets.find((sheet) => sheet.header !== null);

	if (!selected) {
		throw new QuotationXlsxImportError(
			options.sheetName
				? 'Wybrany arkusz nie istnieje.'
				: 'Nie znaleziono arkusza z tabelą pozycji.',
			options.sheetName ? 'SHEET_NOT_FOUND' : 'HEADER_NOT_FOUND'
		);
	}

	const detectedHeader =
		selected.header ??
		(options.mapping ? headerFromManualMapping(selected.rows, options.mapping) : null);
	if (!detectedHeader) {
		throw new QuotationXlsxImportError(
			'Nie wykryto kolumn nazwy, ilości i ceny jednostkowej brutto.',
			'HEADER_NOT_FOUND'
		);
	}

	const mapping = { ...detectedHeader.mapping, ...options.mapping };
	if (!hasRequiredMapping(mapping)) {
		throw new QuotationXlsxImportError(
			'Mapowanie musi zawierać nazwę, ilość i cenę jednostkową brutto.',
			'HEADER_NOT_FOUND'
		);
	}

	const dataRows = selected.rows
		.slice(detectedHeader.rowIndex + 1)
		.filter((row) => isNonEmptyRow(row) && !isSummaryRow(row, mapping));
	if (dataRows.length > MAX_QUOTATION_IMPORT_ROWS) {
		throw new QuotationXlsxImportError(
			`Arkusz może zawierać maksymalnie ${MAX_QUOTATION_IMPORT_ROWS} pozycji.`,
			'TOO_MANY_ROWS'
		);
	}

	const issues: QuotationImportIssue[] = [];
	const items: ImportedQuotationItem[] = [];
	if (!options.mapping) {
		for (const field of Object.keys(HEADER_ALIASES) as QuotationImportField[]) {
			const candidates = selected.rows[detectedHeader.rowIndex]
				.map(cellText)
				.map((header, index) => ({ header, index }))
				.filter(({ header }) => HEADER_ALIASES[field].includes(normalizeLabel(header)));
			if (candidates.length > 1 && detectedHeader.mapping[field] !== undefined) {
				issues.push({
					rowNumber: detectedHeader.rowIndex + 1,
					field,
					message: `Znaleziono kilka możliwych kolumn dla pola „${field}”. Sprawdź mapowanie.`
				});
			}
		}
	}

	for (let index = detectedHeader.rowIndex + 1; index < selected.rows.length; index += 1) {
		const row = selected.rows[index];
		if (!isNonEmptyRow(row) || isSummaryRow(row, mapping)) continue;

		const rowNumber = index + 1;
		const item = parseItem(row, rowNumber, mapping, issues);
		items.push({ ...item, sortOrder: items.length });
		if (items.length > MAX_QUOTATION_IMPORT_ROWS) {
			throw new QuotationXlsxImportError(
				`Arkusz może zawierać maksymalnie ${MAX_QUOTATION_IMPORT_ROWS} pozycji.`,
				'TOO_MANY_ROWS'
			);
		}
	}

	return {
		sheets,
		selectedSheetName: selected.name,
		headerRowNumber: detectedHeader.rowIndex + 1,
		headers: detectedHeader.headers,
		mapping,
		items,
		issues,
		totalGrossCents: items.reduce((total, item) => total + item.totalGrossCents, 0)
	};
}

function sheetToRows(sheet: XLSX.WorkSheet | undefined): SheetRows {
	if (!sheet) return [];
	return XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
		header: 1,
		defval: null,
		raw: true,
		blankrows: false
	}) as SheetRows;
}

function detectHeader(rows: SheetRows): DetectedHeader | null {
	let best: DetectedHeader | null = null;

	for (let rowIndex = 0; rowIndex < Math.min(rows.length, 30); rowIndex += 1) {
		const headers = rows[rowIndex].map(cellText);
		const mapping = suggestMapping(headers);
		const score = Object.keys(mapping).length;
		if (hasRequiredMapping(mapping) && (!best || score > best.score)) {
			best = { rowIndex, headers, mapping, score };
		}
	}

	return best;
}

function headerFromManualMapping(
	rows: SheetRows,
	mapping: QuotationColumnMapping
): DetectedHeader | null {
	const rowIndex = rows.findIndex(isNonEmptyRow);
	if (rowIndex < 0 || !hasRequiredMapping(mapping)) return null;
	return {
		rowIndex,
		headers: rows[rowIndex].map(cellText),
		mapping,
		score: Object.keys(mapping).length
	};
}

export function suggestQuotationColumnMapping(headers: string[]): QuotationColumnMapping {
	return suggestMapping(headers);
}

function suggestMapping(headers: string[]): QuotationColumnMapping {
	const mapping: QuotationColumnMapping = {};
	const usedColumns = new Set<number>();
	for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
		QuotationImportField,
		string[]
	][]) {
		const column = headers.findIndex(
			(header, index) => !usedColumns.has(index) && aliases.includes(normalizeLabel(header))
		);
		if (column >= 0) {
			mapping[field] = column;
			usedColumns.add(column);
		}
	}
	return mapping;
}

function parseItem(
	row: CellValue[],
	rowNumber: number,
	mapping: QuotationColumnMapping,
	issues: QuotationImportIssue[]
): Omit<ImportedQuotationItem, 'sortOrder'> {
	const name = cellText(row[mapping.name!]);
	const parsedQuantity = parsePositiveQuantity(row[mapping.quantity!]);
	const parsedUnitGrossCents = parseMoneyCents(row[mapping.unitGross!]);
	const invalidFields: QuotationImportField[] = [];

	if (!name) {
		issues.push({ rowNumber, field: 'name', message: 'Brak nazwy pozycji.' });
		invalidFields.push('name');
	}
	if (parsedQuantity === null) {
		issues.push({
			rowNumber,
			field: 'quantity',
			message: 'Ilość musi być dodatnia i mieć maksymalnie 3 miejsca po przecinku.'
		});
		invalidFields.push('quantity');
	}
	if (parsedUnitGrossCents === null) {
		issues.push({
			rowNumber,
			field: 'unitGross',
			message: 'Cena jednostkowa brutto musi być liczbą nieujemną.'
		});
		invalidFields.push('unitGross');
	}
	const quantity = parsedQuantity ?? 0;
	const unitGrossCents = parsedUnitGrossCents ?? 0;

	const shortDescription = mappedText(row, mapping.shortDescription);
	const categoryTitle = mappedText(row, mapping.category);
	const unit = mappedText(row, mapping.unit) || 'szt.';
	const quantityMilli = Math.round(quantity * 1000);

	return {
		id: `xlsx-row-${rowNumber}`,
		name,
		...(shortDescription ? { shortDescription } : {}),
		quantity,
		unit,
		unitGrossCents,
		totalGrossCents: Math.round((quantityMilli * unitGrossCents) / 1000),
		...(categoryTitle ? { categoryTitle } : {}),
		sourceRowNumber: rowNumber,
		...(invalidFields.length > 0 ? { invalidFields } : {})
	};
}

function isSummaryRow(row: CellValue[], mapping: QuotationColumnMapping): boolean {
	const name = normalizeLabel(cellText(row[mapping.name!]));
	return /^(razem|suma|podsumowanie)( |$)/.test(name);
}

function parsePositiveQuantity(value: CellValue): number | null {
	const normalized = normalizeNumber(value);
	if (!normalized || !/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;
	const quantity = Number(normalized);
	return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

function parseMoneyCents(value: CellValue): number | null {
	const normalized = normalizeNumber(value);
	if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return null;
	const amount = Number(normalized);
	if (!Number.isFinite(amount) || amount < 0) return null;
	return Math.round((amount + Number.EPSILON) * 100);
}

function normalizeNumber(value: CellValue): string {
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
	if (typeof value !== 'string') return '';

	let normalized = value
		.trim()
		.replace(/[\s\u00a0]/g, '')
		.replace(/(?:pln|zł)$/i, '')
		.replace(/[^\d,.-]/g, '');
	if (!normalized) return '';

	const lastComma = normalized.lastIndexOf(',');
	const lastDot = normalized.lastIndexOf('.');
	if (lastComma >= 0 && lastDot >= 0) {
		const decimalSeparator = lastComma > lastDot ? ',' : '.';
		normalized = normalized.replace(decimalSeparator === ',' ? /\./g : /,/g, '');
		if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
	} else if (lastComma >= 0) {
		normalized = normalized.replace(',', '.');
	}

	return normalized;
}

function mappedText(row: CellValue[], column: number | undefined): string {
	return column === undefined ? '' : cellText(row[column]);
}

function cellText(value: CellValue): string {
	if (value === null || value === undefined) return '';
	return String(value).trim();
}

function normalizeLabel(value: string): string {
	return value
		.toLocaleLowerCase('pl-PL')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function isNonEmptyRow(row: CellValue[]): boolean {
	return row.some((cell) => cellText(cell) !== '');
}

function hasRequiredMapping(mapping: QuotationColumnMapping): boolean {
	return REQUIRED_FIELDS.every((field) => mapping[field] !== undefined);
}
