import React, { useEffect, useState } from 'react';
import { X, Loader2, FolderPlus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpace: 'personal' | 'main';
  onCreated: (opts: { slug?: string; name: string }) => void;
  pathSegments: string[]; // for potential contextual future use
}

export default function NewFolderModal({ isOpen, onClose, currentSpace, onCreated }: NewFolderModalProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ if (isOpen) { setValue(''); } }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) { onClose(); return; }
    if (!/^[\w\-. ]{1,64}$/.test(name)) { toast.error('Nieprawidłowa nazwa'); return; }
    setLoading(true);
    try {
  const token = await auth.currentUser?.getIdToken().catch(()=>null);
  if (!token) { toast.error('Brak autoryzacji'); return; }
  const res = await fetch('/api/files/folder', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ folder: currentSpace, name }) });
      if (!res.ok) {
        const { error } = await res.json().catch(()=>({error:'Błąd tworzenia folderu'}));
        toast.error(error || 'Błąd tworzenia folderu');
      } else {
        const data = await res.json();
        toast.success('Folder utworzony');
        onCreated({ slug: data.slug, name });
      }
    } catch { toast.error('Błąd sieci'); }
    finally { setLoading(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[10000] p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Nowy folder">
      <Card className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl">
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 text-gray-900"><FolderPlus className="h-4 w-4 sm:h-5 sm:w-5"/>Nowy folder</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="no-min-touch p-1.5 sm:p-2"><X className="h-4 w-4 sm:h-5 sm:w-5" /></Button>
        </CardHeader>
        <CardContent className="pb-safe">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Nazwa folderu</label>
              <input autoFocus value={value} onChange={(e)=>setValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-2.5 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 text-gray-900" maxLength={64} />
              <p className="mt-1 text-[10px] sm:text-xs text-gray-500">Dozwolone: litery, cyfry, spacje, _ - . (max 64)</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="text-xs sm:text-sm py-2.5 sm:py-2">Anuluj</Button>
              <Button type="submit" variant="primary" disabled={loading || !value.trim()} className="text-xs sm:text-sm py-2.5 sm:py-2"> {loading ? <><Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2"/>Tworzenie</> : 'Utwórz'} </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
