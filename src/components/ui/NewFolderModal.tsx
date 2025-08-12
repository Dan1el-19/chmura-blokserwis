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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" role="dialog" aria-modal="true" aria-label="Nowy folder">
      <Card className="max-w-sm w-full">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900"><FolderPlus className="h-5 w-5"/>Nowy folder</h3>
          <Button variant="ghost" size="sm" onClick={onClose} className="p-2"><X className="h-5 w-5" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa folderu</label>
              <input autoFocus value={value} onChange={(e)=>setValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500 text-gray-900" maxLength={64} />
              <p className="mt-1 text-xs text-gray-500">Dozwolone: litery, cyfry, spacje, _ - . (max 64)</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Anuluj</Button>
              <Button type="submit" variant="primary" disabled={loading || !value.trim()}> {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2"/>Tworzenie</> : 'Utwórz'} </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
