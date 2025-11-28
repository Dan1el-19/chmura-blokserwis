'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  FileText, 
  Activity, 
  UserPlus, 
  Edit, 
  Trash2, 
  ArrowLeft,
  HardDrive
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatBytes, formatDate } from '@/lib/utils';
import { User, UserRole, ActivityLog } from '@/types';

export default function AdminPanel() {
  const [user, loading] = useAuthState(auth);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'stats'>('users');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [mainStorageUsed, setMainStorageUsed] = useState(0);
  const [mainStorageLimit, setMainStorageLimit] = useState(50 * 1024 * 1024 * 1024); // 50GB
  const [showMainStorageModal, setShowMainStorageModal] = useState(false);

  const router = useRouter();

  const refreshIdToken = useCallback(async () => {
    try { if (auth.currentUser) { await auth.currentUser.getIdToken(true); } } catch {}
  }, []);

  const checkAdminRole = useCallback(async () => {
    try {
      await refreshIdToken();
      const response = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
      });
      if (response.ok) {
        const userData = await response.json();
        if (userData.role !== 'admin') { router.push('/storage'); toast.error('Brak uprawnień administratora'); }
      }
    } catch {}
  }, [user, router, refreshIdToken]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
      });
      if (response.ok) { setUsers(await response.json()); }
    } catch {}
  }, [user]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
      });
      if (response.ok) { setLogs(await response.json()); }
    } catch {}
  }, [user]);

  const fetchMainStorage = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/main-storage', {
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMainStorageUsed(data.storageUsed);
      }
    } catch {}
  }, [user]);

  const fetchData = useCallback(async () => {
    if (activeTab === 'users') await fetchUsers();
    else if (activeTab === 'logs') await fetchLogs();
    else if (activeTab === 'stats') {
      await fetchUsers();
      await fetchMainStorage();
    }
  }, [activeTab, fetchUsers, fetchLogs, fetchMainStorage]);

  useEffect(() => { if (!loading && !user) { router.push('/login'); } else if (user) { checkAdminRole(); } }, [user, loading, router, checkAdminRole]);
  useEffect(() => { if (user) { fetchData(); } }, [user, fetchData]);

  const handleCreateUser = async (form: { email: string; displayName?: string; role: UserRole; storageLimitGb: number; password?: string; }) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });
      if (res.ok) { toast.success('Użytkownik utworzony'); setShowCreate(false); fetchUsers(); }
      else { const { error } = await res.json(); toast.error(error || 'Błąd tworzenia użytkownika'); }
    } catch { toast.error('Błąd tworzenia użytkownika'); }
  };

  const handleUpdateUser = async (userData: Partial<User>) => {
    try {
      const response = await fetch('/api/admin/users/update', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (response.ok) { toast.success('Użytkownik zaktualizowany'); setEditingUser(null); fetchUsers(); }
      else { toast.error('Błąd podczas aktualizacji użytkownika'); }
    } catch { toast.error('Błąd podczas aktualizacji użytkownika'); }
  };

  const handleChangePassword = async (user: User) => {
    setPasswordUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;

    try {
      const res = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: passwordUser.uid, password: newPassword || undefined })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.generated && data.password) {
          await navigator.clipboard.writeText(data.password);
          toast.success('Hasło wygenerowane i skopiowane do schowka');
        } else {
          toast.success('Hasło ustawione');
        }
        setShowPasswordModal(false);
        setPasswordUser(null);
        setNewPassword('');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Błąd ustawiania hasła');
      }
    } catch {
      toast.error('Błąd ustawiania hasła');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego użytkownika?')) return;
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${await user?.getIdToken()}` }
      });
      if (response.ok) { toast.success('Użytkownik usunięty'); fetchUsers(); }
      else { toast.error('Błąd podczas usuwania użytkownika'); }
    } catch { toast.error('Błąd podczas usuwania użytkownika'); }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'plus': return 'bg-blue-100 text-blue-800';
      case 'basic': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'upload': return 'text-green-600';
      case 'download': return 'text-blue-600';
      case 'delete': return 'text-red-600';
      case 'share': return 'text-purple-600';
      case 'login': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-4 gap-3">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/storage')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 font-roboto">Panel Administracyjny</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex overflow-x-auto gap-6 sm:gap-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Użytkownicy
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Logi aktywności
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Statystyki
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'users' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Zarządzanie użytkownikami</h2>
              <button
                onClick={() => setShowCreate(true)}
                className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium hover:bg-blue-700 self-start sm:self-auto"
              >
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 inline mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Dodaj użytkownika</span>
                <span className="sm:hidden">Dodaj</span>
              </button>
            </div>

            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Użytkownik
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rola
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Przestrzeń
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ostatnie logowanie
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Akcje
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.uid} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <HardDrive className="h-4 w-4 text-gray-400" />
                            <span>{formatBytes(user.storageUsed)} / {formatBytes(user.storageLimit)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div 
                              className={`h-1 rounded-full ${
                                (user.storageUsed / user.storageLimit) > 0.9 ? 'bg-red-500' : 
                                (user.storageUsed / user.storageLimit) > 0.7 ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min((user.storageUsed / user.storageLimit) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.lastLogin)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleChangePassword(user)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Zmień hasło"
                            >
                              <span className="text-xs font-semibold">PWD</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.uid)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Logi aktywności</h2>
            
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Użytkownik
                      </th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Akcja
                      </th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                        Plik
                      </th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-2 sm:px-6 py-2 sm:py-4">
                          <div className="text-[10px] sm:text-sm text-gray-900 truncate max-w-[80px] sm:max-w-none">{log.userEmail}</div>
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-[10px] sm:text-sm text-gray-500 hidden sm:table-cell">
                          {log.fileName || '-'}
                        </td>
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-[10px] sm:text-sm text-gray-500">
                          {formatDate(log.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Statystyki systemu</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" />
                  <div className="ml-2 sm:ml-4 min-w-0">
                    <p className="text-[10px] sm:text-sm font-medium text-gray-500">Użytkownicy</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900">{users.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <HardDrive className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 shrink-0" />
                  <div className="ml-2 sm:ml-4 min-w-0">
                    <p className="text-[10px] sm:text-sm font-medium text-gray-500">Przestrzeń</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                      {formatBytes(users.reduce((acc, user) => acc + user.storageUsed, 0))}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm col-span-2 md:col-span-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center min-w-0">
                    <HardDrive className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" />
                    <div className="ml-2 sm:ml-4 min-w-0">
                      <p className="text-[10px] sm:text-sm font-medium text-gray-500">Folder główny</p>
                      <p className="text-base sm:text-2xl font-semibold text-gray-900">
                        <span className="hidden sm:inline">{formatBytes(mainStorageUsed)} / {formatBytes(mainStorageLimit)}</span>
                        <span className="sm:hidden">{formatBytes(mainStorageUsed)}</span>
                      </p>
                      <p className="text-[10px] sm:text-sm text-gray-500">
                        {Math.round((mainStorageUsed / mainStorageLimit) * 100)}% wykorzystane
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMainStorageModal(true)}
                    className="text-blue-600 hover:text-blue-900 text-[10px] sm:text-sm font-medium shrink-0"
                  >
                    Edytuj
                  </button>
                </div>
              </div>

              <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
                <div className="flex items-center">
                  <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 shrink-0" />
                  <div className="ml-2 sm:ml-4 min-w-0">
                    <p className="text-[10px] sm:text-sm font-medium text-gray-500">Akcje dzisiaj</p>
                    <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                      {logs.filter(log => {
                        const today = new Date();
                        const logDate = new Date(log.timestamp);
                        return logDate.toDateString() === today.toDateString();
                      }).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* User Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full sm:w-96 p-4 sm:p-5 border shadow-lg rounded-t-2xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edytuj użytkownika</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleUpdateUser({
                  uid: editingUser.uid,
                  role: formData.get('role') as UserRole,
                  storageLimit: parseInt(formData.get('storageLimit') as string) * 1024 * 1024 * 1024
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={editingUser.email}
                      disabled
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rola</label>
                    <select
                      name="role"
                      defaultValue={editingUser.role}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    >
                      <option value="basic">Basic</option>
                      <option value="plus">Plus</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Limit przestrzeni (GB)</label>
                    <input
                      type="number"
                      name="storageLimit"
                      defaultValue={Math.floor(editingUser.storageLimit / (1024 * 1024 * 1024))}
                      min="1"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 autofill:bg-white autofill:text-black"
                      style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }}
                    />
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full sm:w-96 p-4 sm:p-5 border shadow-lg rounded-t-2xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Nowy użytkownik</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                await handleCreateUser({
                  email: String(data.get('email') || ''),
                  displayName: String(data.get('displayName') || ''),
                  role: (String(data.get('role') || 'basic') as UserRole),
                  storageLimitGb: Number(data.get('storageLimit') || 5),
                  password: String(data.get('password') || '') || undefined,
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input name="email" type="email" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black placeholder-gray-400 autofill:bg-white autofill:text-black" style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nazwa</label>
                    <input name="displayName" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black placeholder-gray-400 autofill:bg-white autofill:text-black" style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rola</label>
                    <select name="role" defaultValue="basic" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black">
                      <option value="basic">Basic</option>
                      <option value="plus">Plus</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Limit (GB)</label>
                    <input name="storageLimit" type="number" min="1" defaultValue={5} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black autofill:bg-white autofill:text-black" style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Hasło (opcjonalne)</label>
                    <input name="password" type="text" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-black placeholder-gray-400 autofill:bg-white autofill:text-black" style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }} />
                  </div>
                </div>
                <div className="mt-6 flex space-x-3">
                  <button type="submit" className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">Utwórz</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400">Anuluj</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full sm:w-96 p-4 sm:p-5 border shadow-lg rounded-t-2xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Zmień hasło użytkownika</h3>
              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={passwordUser.email}
                      disabled
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Nowe hasło (min 6 znaków)
                    </label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Zostaw puste, by wygenerować automatycznie"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 autofill:bg-white autofill:text-black"
                      style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Jeśli zostawisz puste, zostanie wygenerowane hasło i skopiowane do schowka
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Zmień hasło
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordUser(null);
                      setNewPassword('');
                    }}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main Storage Limit Modal */}
      {showMainStorageModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="relative w-full sm:w-96 p-4 sm:p-5 border shadow-lg rounded-t-2xl sm:rounded-xl bg-white max-h-[90vh] overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edytuj limit folderu głównego</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newLimit = parseInt(formData.get('limit') as string) * 1024 * 1024 * 1024;
                setMainStorageLimit(newLimit);
                setShowMainStorageModal(false);
                toast.success('Limit folderu głównego został zaktualizowany');
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Aktualny limit</label>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatBytes(mainStorageLimit)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nowy limit (GB)</label>
                    <input
                      type="number"
                      name="limit"
                      defaultValue={Math.floor(mainStorageLimit / (1024 * 1024 * 1024))}
                      min="1"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 autofill:bg-white autofill:text-black"
                      style={{ WebkitTextFillColor: 'black', WebkitBoxShadow: '0 0 0 30px white inset', boxShadow: '0 0 0 30px white inset' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Aktualne użycie</label>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatBytes(mainStorageUsed)} ({Math.round((mainStorageUsed / mainStorageLimit) * 100)}%)
                    </p>
                  </div>
                </div>
                
                <div className="mt-6 flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMainStorageModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
