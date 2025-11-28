"use client";
import React, { useState } from 'react';
import { Search, Filter, SortAsc, SortDesc, Calendar, HardDrive } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { FileItem } from '@/types';

export interface FileFilters {
	search: string;
	sortBy: 'name' | 'size' | 'date' | 'type';
	sortOrder: 'asc' | 'desc';
	fileType: string;
	minSize: number;
	maxSize: number;
	dateFrom: string;
	dateTo: string;
}

interface FileFiltersProps {
	filters: FileFilters;
	onFiltersChange: (filters: FileFilters) => void;
	totalFiles: number;
	filteredFiles: number;
}

export default function FileFilters({ filters, onFiltersChange, totalFiles, filteredFiles }: FileFiltersProps) {
	const [showAdvanced, setShowAdvanced] = useState(false);

	const updateFilter = (key: keyof FileFilters, value: string | number) => {
		onFiltersChange({ ...filters, [key]: value });
	};

	const clearFilters = () => {
		onFiltersChange({
			search: '',
			sortBy: 'name',
			sortOrder: 'asc',
			fileType: '',
			minSize: 0,
			maxSize: 0,
			dateFrom: '',
			dateTo: ''
		});
	};



	const fileTypeOptions = [
		{ value: '', label: 'Wszystkie typy' },
		{ value: 'image', label: 'Obrazy' },
		{ value: 'document', label: 'Dokumenty' },
		{ value: 'spreadsheet', label: 'Arkusze' },
		{ value: 'presentation', label: 'Prezentacje' },
		{ value: 'archive', label: 'Archiwa' },
		{ value: 'audio', label: 'Audio' },
		{ value: 'video', label: 'Video' },
		{ value: 'code', label: 'Kod' },
		{ value: 'other', label: 'Inne' }
	];

	return (
		<div className="bg-white border border-gray-200 rounded-lg p-2.5 sm:p-4 mb-3 sm:mb-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
				<div className="flex items-center gap-2 sm:gap-4">
					<h3 className="text-sm sm:text-lg font-medium text-gray-900">Filtry i sortowanie</h3>
					<span className="text-[10px] sm:text-sm text-gray-500">
						{filteredFiles} z {totalFiles}
					</span>
				</div>
				<div className="flex items-center gap-1.5 sm:gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowAdvanced(!showAdvanced)}
						className="text-[10px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
					>
						<Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
						<span className="hidden sm:inline">{showAdvanced ? 'Ukryj' : 'Zaawansowane'}</span>
						<span className="sm:hidden">{showAdvanced ? 'Ukryj' : 'Więcej'}</span>
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={clearFilters}
						className="text-[10px] sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5"
					>
						<span className="hidden sm:inline">Wyczyść filtry</span>
						<span className="sm:hidden">Wyczyść</span>
					</Button>
				</div>
			</div>

			{/* Podstawowe filtry */}
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
				<div className="relative">
					<Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
					<Input
						type="text"
						placeholder="Szukaj plików..."
						value={filters.search}
						onChange={(e) => updateFilter('search', e.target.value)}
						className="pl-8 sm:pl-10 text-xs sm:text-sm py-1.5 sm:py-2"
					/>
				</div>

				<div className="flex gap-1.5 sm:gap-2">
					<select
						value={filters.sortBy}
						onChange={(e) => updateFilter('sortBy', e.target.value)}
						className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="name">Nazwa</option>
						<option value="size">Rozmiar</option>
						<option value="date">Data</option>
						<option value="type">Typ</option>
					</select>
					<Button
						variant="outline"
						size="sm"
						onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
						className="px-2 sm:px-3"
					>
						{filters.sortOrder === 'asc' ? (
							<SortAsc className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						) : (
							<SortDesc className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
						)}
					</Button>
				</div>

				<select
					value={filters.fileType}
					onChange={(e) => updateFilter('fileType', e.target.value)}
					className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					{fileTypeOptions.map(option => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			{/* Zaawansowane filtry */}
			{showAdvanced && (
				<div className="border-t border-gray-200 pt-3 sm:pt-4">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
						<div>
							<label className="block text-[10px] sm:text-sm font-medium text-gray-700 mb-1">
								<HardDrive className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
								Min. rozmiar
							</label>
							<Input
								type="number"
								placeholder="0 B"
								value={filters.minSize || ''}
								onChange={(e) => updateFilter('minSize', parseInt(e.target.value) || 0)}
								className="text-xs sm:text-sm"
							/>
						</div>

						<div>
							<label className="block text-[10px] sm:text-sm font-medium text-gray-700 mb-1">
								<HardDrive className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
								Max. rozmiar
							</label>
							<Input
								type="number"
								placeholder="∞"
								value={filters.maxSize || ''}
								onChange={(e) => updateFilter('maxSize', parseInt(e.target.value) || 0)}
								className="text-xs sm:text-sm"
							/>
						</div>

						<div>
							<label className="block text-[10px] sm:text-sm font-medium text-gray-700 mb-1">
								<Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
								Od daty
							</label>
							<Input
								type="date"
								value={filters.dateFrom}
								onChange={(e) => updateFilter('dateFrom', e.target.value)}
								className="text-xs sm:text-sm"
							/>
						</div>

						<div>
							<label className="block text-[10px] sm:text-sm font-medium text-gray-700 mb-1">
								<Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
								Do daty
							</label>
							<Input
								type="date"
								value={filters.dateTo}
								onChange={(e) => updateFilter('dateTo', e.target.value)}
								className="text-xs sm:text-sm"
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Helper function do filtrowania plików
export function filterFiles(files: FileItem[], filters: FileFilters): FileItem[] {
	let filtered = [...files];

	// Filtrowanie po wyszukiwaniu
	if (filters.search) {
		const searchLower = filters.search.toLowerCase();
		filtered = filtered.filter(file => 
			file.name.toLowerCase().includes(searchLower)
		);
	}

	// Filtrowanie po typie pliku
	if (filters.fileType) {
		filtered = filtered.filter(file => {
			const fileType = getFileType(file.name);
			return fileType === filters.fileType;
		});
	}

	// Filtrowanie po rozmiarze
	if (filters.minSize > 0) {
		filtered = filtered.filter(file => file.size >= filters.minSize);
	}
	if (filters.maxSize > 0) {
		filtered = filtered.filter(file => file.size <= filters.maxSize);
	}

	// Filtrowanie po dacie
	if (filters.dateFrom) {
		const fromDate = new Date(filters.dateFrom);
		filtered = filtered.filter(file => file.lastModified >= fromDate);
	}
	if (filters.dateTo) {
		const toDate = new Date(filters.dateTo);
		toDate.setHours(23, 59, 59, 999); // Koniec dnia
		filtered = filtered.filter(file => file.lastModified <= toDate);
	}

	// Sortowanie
	filtered.sort((a, b) => {
		let comparison = 0;
		
		switch (filters.sortBy) {
			case 'name':
				comparison = a.name.localeCompare(b.name);
				break;
			case 'size':
				comparison = a.size - b.size;
				break;
			case 'date':
				comparison = a.lastModified.getTime() - b.lastModified.getTime();
				break;
			case 'type':
				comparison = getFileType(a.name).localeCompare(getFileType(b.name));
				break;
		}

		return filters.sortOrder === 'asc' ? comparison : -comparison;
	});

	return filtered;
}

// Helper function do pobierania typu pliku
export function getFileType(fileName: string): string {
	const extension = fileName.split('.').pop()?.toLowerCase() || '';
	const typeMap: Record<string, string> = {
		// Obrazy
		jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image',
		// Dokumenty
		pdf: 'document', doc: 'document', docx: 'document', txt: 'document', md: 'document',
		// Arkusze
		xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet',
		// Prezentacje
		ppt: 'presentation', pptx: 'presentation',
		// Archiwa
		zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
		// Media
		mp3: 'audio', wav: 'audio', mp4: 'video', avi: 'video', mov: 'video',
		// Kod
		js: 'code', ts: 'code', py: 'code', java: 'code', cpp: 'code', c: 'code', html: 'code', css: 'code'
	};
	return typeMap[extension] || 'other';
}
