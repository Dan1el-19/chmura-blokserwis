import React, { useEffect, useState, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileKey: string | null;
  currentName: string | null;
  onRenamed: () => void;
}

export default function RenameModal({
  isOpen,
  onClose,
  fileKey,
  currentName,
  onRenamed,
}: RenameModalProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(currentName || "");
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentName]);

  // Handle visual viewport resize (keyboard open/close)
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      // Scroll input into view when keyboard opens
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    };

    // Use visualViewport API if available (better for mobile keyboards)
    if (typeof window !== "undefined" && window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      return () =>
        window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, [isOpen]);

  if (!isOpen || !fileKey || !currentName) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newName = value.trim();
    if (!newName || newName === currentName) {
      onClose();
      return;
    }
    if (newName.includes("/")) {
      toast.error("Nazwa nie może zawierać /");
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      if (!token) {
        toast.error("Brak autoryzacji");
        return;
      }

      const res = await fetch("/api/files/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key: fileKey, newName }),
      });
      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: "Błąd zmiany nazwy" }));
        toast.error(error || "Błąd zmiany nazwy");
      } else {
        toast.success("Zmieniono nazwę");
        onRenamed();
      }
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-[12000] p-4 pt-[20vh] sm:pt-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Zmień nazwę pliku"
    >
      <Card className="w-full max-w-sm rounded-xl shadow-xl">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Zmień nazwę
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="no-min-touch p-1.5 sm:p-2"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
                Nowa nazwa
              </label>
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 text-gray-900"
                maxLength={256}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-sm py-2.5"
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  loading || !value.trim() || value.trim() === currentName
                }
                className="text-sm py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Zapisywanie
                  </>
                ) : (
                  "Zapisz"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
