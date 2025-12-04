'use client';

interface OverwriteConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OverwriteConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
}: OverwriteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-11000 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4">
        <h4 className="text-lg font-semibold">Nadpisać istniejące pliki?</h4>
        <p className="text-sm text-gray-600">
          Niektóre pliki istnieją w folderze docelowym. Kontynuacja spowoduje ich
          nadpisanie.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            Anuluj
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Nadpisz
          </button>
        </div>
      </div>
    </div>
  );
}
