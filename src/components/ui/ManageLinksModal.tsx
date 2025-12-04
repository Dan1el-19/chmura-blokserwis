import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Copy,
  Check,
  Trash2,
  Edit,
  Clock,
  Calendar,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import StatsModal from "./StatsModal";

interface Link {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
  isExpired: boolean;
}

interface ManageLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileKey: string;
  fileName: string;
}

export default function ManageLinksModal({
  isOpen,
  onClose,
  fileKey,
  fileName,
}: ManageLinksModalProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExpiresIn, setEditExpiresIn] = useState(1);
  const [editTimeUnit, setEditTimeUnit] = useState<
    "minutes" | "hours" | "days" | "months"
  >("days");
  const [useCustomEditDate, setUseCustomEditDate] = useState(false);
  const [editCustomDate, setEditCustomDate] = useState("");
  const [editCustomTime, setEditCustomTime] = useState("");
  const [showStatsModal, setShowStatsModal] = useState(false);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await import("@/lib/firebase").then(
        (m) => m.auth.currentUser
      );
      if (!user) {
        setError("Brak autoryzacji");
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch(
        `/api/files/links?fileKey=${encodeURIComponent(fileKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Błąd podczas ładowania linków");
        return;
      }

      const data = await response.json();
      setLinks(data.links);
    } catch {
      setError("Błąd podczas ładowania linków");
    } finally {
      setLoading(false);
    }
  }, [fileKey]);

  useEffect(() => {
    if (isOpen && fileKey) {
      fetchLinks();
    }
  }, [isOpen, fileKey, fetchLinks]);

  const handleCopy = async (url: string, linkId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedId(linkId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten link?")) {
      return;
    }

    try {
      const user = await import("@/lib/firebase").then(
        (m) => m.auth.currentUser
      );
      if (!user) {
        alert("Brak autoryzacji");
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/files/links", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ linkId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Błąd podczas usuwania linku");
        return;
      }

      // Usuń link z listy
      setLinks(links.filter((link) => link.id !== linkId));
    } catch {
      alert("Błąd podczas usuwania linku");
    }
  };

  const handleEdit = async (linkId: string) => {
    const link = links.find((l) => l.id === linkId);
    if (!link) return;

    setEditingLink(linkId);
    setEditName(link.name);
    setEditExpiresIn(1);
    setEditTimeUnit("days");
    setUseCustomEditDate(false);
    setEditCustomDate("");
    setEditCustomTime("");
  };

  const handleSaveEdit = async () => {
    if (!editingLink) return;

    try {
      const user = await import("@/lib/firebase").then(
        (m) => m.auth.currentUser
      );
      if (!user) {
        alert("Brak autoryzacji");
        return;
      }

      const token = await user.getIdToken();

      let expiresIn: number | undefined;
      let expiresAt: string | undefined;

      if (useCustomEditDate) {
        if (!editCustomDate || !editCustomTime) {
          alert("Proszę wybrać datę i godzinę");
          return;
        }
        expiresAt = new Date(
          `${editCustomDate}T${editCustomTime}`
        ).toISOString();
      } else {
        const multipliers = {
          minutes: 60,
          hours: 60 * 60,
          days: 24 * 60 * 60,
          months: 30 * 24 * 60 * 60,
        };
        expiresIn = editExpiresIn * multipliers[editTimeUnit];
      }

      const response = await fetch("/api/files/links", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          linkId: editingLink,
          name: editName,
          expiresIn,
          expiresAt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || "Błąd podczas edycji linku");
        return;
      }

      // Odśwież listę linków
      await fetchLinks();
      setEditingLink(null);
    } catch (err) {
      console.error("Error editing link:", err);
      alert("Błąd podczas edycji linku");
    }
  };

  const handleCancelEdit = () => {
    setEditingLink(null);
    setEditName("");
    setEditExpiresIn(1);
    setEditTimeUnit("days");
    setUseCustomEditDate(false);
    setEditCustomDate("");
    setEditCustomTime("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <Card className="w-full sm:max-w-4xl rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">
            Zarządzanie linkami
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="no-min-touch p-1.5 sm:p-2 flex-shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)] pb-safe">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs sm:text-sm text-gray-600 truncate">
              Plik:{" "}
              <span className="font-medium text-gray-900 break-all">
                {fileName}
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatsModal(true)}
              className="flex items-center justify-center gap-2 text-xs sm:text-sm self-start sm:self-auto"
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Statystyki
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center p-4">
              <p className="text-red-600 text-sm">{error}</p>
              <Button
                variant="outline"
                onClick={fetchLinks}
                className="mt-2 text-xs sm:text-sm"
              >
                Spróbuj ponownie
              </Button>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center p-6 sm:p-8">
              <p className="text-gray-600 text-sm">
                Brak aktywnych linków dla tego pliku
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="border border-gray-200 rounded-lg p-3 sm:p-4"
                >
                  {editingLink === link.id ? (
                    // Tryb edycji
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <label className="block text-xs sm:text-sm text-gray-600 mb-1">
                          Nazwa linku:
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                          style={{
                            WebkitTextFillColor: "black",
                            WebkitBoxShadow: "0 0 0 30px white inset",
                            boxShadow: "0 0 0 30px white inset",
                          }}
                        />
                      </div>

                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            id={`relative-edit-${link.id}`}
                            checked={!useCustomEditDate}
                            onChange={() => setUseCustomEditDate(false)}
                            className="text-gray-900"
                          />
                          <label
                            htmlFor={`relative-edit-${link.id}`}
                            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-900"
                          >
                            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Link ważny przez
                          </label>
                        </div>

                        {!useCustomEditDate && (
                          <div className="ml-6 flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              value={editExpiresIn}
                              onChange={(e) =>
                                setEditExpiresIn(parseInt(e.target.value) || 1)
                              }
                              className="w-16 sm:w-20 px-2 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                              style={{
                                WebkitTextFillColor: "black",
                                WebkitBoxShadow: "0 0 0 30px white inset",
                                boxShadow: "0 0 0 30px white inset",
                              }}
                            />
                            <select
                              value={editTimeUnit}
                              onChange={(e) =>
                                setEditTimeUnit(
                                  e.target.value as
                                    | "minutes"
                                    | "hours"
                                    | "days"
                                    | "months"
                                )
                              }
                              className="px-2 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900"
                            >
                              <option value="minutes">minut</option>
                              <option value="hours">godzin</option>
                              <option value="days">dni</option>
                              <option value="months">miesięcy</option>
                            </select>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            id={`custom-edit-${link.id}`}
                            checked={useCustomEditDate}
                            onChange={() => setUseCustomEditDate(true)}
                            className="text-gray-900"
                          />
                          <label
                            htmlFor={`custom-edit-${link.id}`}
                            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-900"
                          >
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Link ważny do konkretnej daty
                          </label>
                        </div>

                        {useCustomEditDate && (
                          <div className="ml-6 space-y-2 sm:space-y-3">
                            <div>
                              <label className="block text-xs sm:text-sm text-gray-600 mb-1">
                                Data:
                              </label>
                              <input
                                type="date"
                                value={editCustomDate}
                                onChange={(e) =>
                                  setEditCustomDate(e.target.value)
                                }
                                min={new Date().toISOString().split("T")[0]}
                                className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                                style={{
                                  WebkitTextFillColor: "black",
                                  WebkitBoxShadow: "0 0 0 30px white inset",
                                  boxShadow: "0 0 0 30px white inset",
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs sm:text-sm text-gray-600 mb-1">
                                Godzina:
                              </label>
                              <input
                                type="time"
                                value={editCustomTime}
                                onChange={(e) =>
                                  setEditCustomTime(e.target.value)
                                }
                                className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                                style={{
                                  WebkitTextFillColor: "black",
                                  WebkitBoxShadow: "0 0 0 30px white inset",
                                  boxShadow: "0 0 0 30px white inset",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
                        >
                          Anuluj
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleSaveEdit}
                          className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
                        >
                          Zapisz
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Tryb wyświetlania
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                            {link.name}
                          </h4>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Utworzony: {formatDate(link.createdAt)}
                          </p>
                          {link.expiresAt && (
                            <p
                              className={`text-xs sm:text-sm ${link.isExpired ? "text-red-600" : "text-gray-600"}`}
                            >
                              Wygasa: {formatDate(link.expiresAt)}
                              {link.isExpired && " (WYGASŁ)"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(link.url, link.id)}
                            className="text-xs sm:text-sm px-2 sm:px-3"
                          >
                            {copiedId === link.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">
                                  Skopiowano
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Kopiuj</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(link.url, "_blank")}
                            className="no-min-touch px-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(link.id)}
                            className="no-min-touch px-2"
                          >
                            <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(link.id)}
                            className="no-min-touch px-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-2 sm:p-3 rounded">
                        <p className="text-xs sm:text-sm text-gray-600 break-all">
                          {link.url}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Modal */}
      <StatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        fileKey={fileKey}
        fileName={fileName}
      />
    </div>
  );
}
