import React, { useEffect, useState } from 'react';
import { X, Loader2, Folder } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string | null; // ends with '/'
  currentName: string | null;
  onRenamed: (info?: { newPath: string; newName: string; slug?: string }) => void;
}

export default function RenameFolderModal({ isOpen, onClose, folderPath, currentName, onRenamed }: RenameFolderModalProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ if (isOpen) { setValue(currentName || ''); } }, [isOpen, currentName]);
  if (!isOpen || !folderPath || !currentName) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newName = value.trim();
    if (!newName || newName === currentName) { onClose(); return; }
    if (!/^[\w\-. ]{1,64}$/.test(newName)) { toast.error('Nieprawidłowa nazwa'); return; }
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken().catch(()=>null);
      if (!token) {
        toast.error('Brak autoryzacji');
        return;
      }
      const res = await fetch('/api/files/rename-folder', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ path: folderPath, newName }) });
      if (!res.ok) {
        const { error } = await res.json().catch(()=>({error:'Błąd zmiany nazwy folderu'}));
        toast.error(error || 'Błąd zmiany nazwy folderu');
      } else {
        const data = await res.json().catch(()=>null);
        toast.success('Zmieniono nazwę folderu');
        if (data?.path && data?.newName) {
          onRenamed({ newPath: data.path, newName: data.newName, slug: data.slug });
        } else {
          onRenamed();
        }
      }
    } catch { toast.error('Błąd sieci'); }
    finally { setLoading(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[10000] p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Zmień nazwę folderu">
      <Card className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl">
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-900"><Folder className="h-4 w-4 sm:h-5 sm:w-5"/>Zmień nazwę folderu</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="no-min-touch p-1.5 sm:p-2"><X className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
        </CardHeader>
        <CardContent className="pb-safe">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Nowa nazwa</label>
              <input autoFocus value={value} onChange={(e)=>setValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-2.5 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 text-gray-900" maxLength={64} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="text-xs sm:text-sm py-2.5 sm:py-2">Anuluj</Button>
              <Button type="submit" variant="primary" disabled={loading || !value.trim() || value.trim()===currentName} className="text-xs sm:text-sm py-2.5 sm:py-2">{loading ? <><Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2"/>Zapisywanie</> : 'Zapisz'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
