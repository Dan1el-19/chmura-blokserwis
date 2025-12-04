'use client';

interface SelectionBarProps {
  selectedCount: number;
  onClear: () => void;
}

export default function SelectionBar({ selectedCount, onClear }: SelectionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="px-4 sm:px-6 py-2 border-b border-gray-100 bg-blue-50 flex items-center justify-between text-sm">
      <span className="text-blue-700 font-medium">
        Zaznaczone: {selectedCount}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onClear}
          className="px-2 py-1 rounded-md border border-blue-200 text-blue-700 hover:bg-white"
        >
          Wyczyść
        </button>
      </div>
    </div>
  );
}
