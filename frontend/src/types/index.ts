export type UserRole = 'basic' | 'plus' | 'admin';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  storageLimit: number; // w bajtach
  storageUsed: number; // w bajtach
  createdAt: Date;
  lastLogin: Date;
}

export interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  contentType: string;
  owner: string;
  path: string;
  isPublic?: boolean;
  publicUrl?: string;
  expiresAt?: Date;
}

export interface FolderItem {
  type: 'folder';
  id?: string; // Firestore doc id
  shortId?: string; // 4-char unique id for routing
  slug?: string; // name-shortId convenience for routes
  name: string;
  path: string; // pełny prefix np. users/{uid}/photos/
  parentPath: string; // bez nazwy folderu na końcu
  owner: string; // uid lub 'main'
  space: 'personal' | 'main';
  createdAt?: Date;
  updatedAt?: Date;
  itemCount?: number;
  sizeSum?: number; // sumaryczny rozmiar (opcjonalnie cache)
}

export type FileSystemItem = (FileItem & { type?: 'file' }) | FolderItem;

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: 'upload' | 'download' | 'delete' | 'share' | 'login';
  fileName?: string;
  fileSize?: number;
  timestamp: Date;
  ipAddress?: string;
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  usedSpace: number;
  availableSpace: number;
}

// Kalkulator kosztów Cloudflare R2
export type Currency = 'PLN' | 'USD';

export interface CostCalculationParams {
  fileSize: number; // w bajtach
  storageDays: number;
  currency: Currency;
  totalSystemUsage: number; // w bajtach
}

export interface CostCalculationResult {
  isFree: boolean;
  costUSD: number;
  costPLN: number;
  paidSize: number; // w bajtach
  freeSize: number; // w bajtach
  remainingFreeSpace: number; // w bajtach
  calculationDetails: {
    totalSystemUsage: number;
    freeTierLimit: number;
    paidSizeGB: number;
    costPerGBPerMonth: number;
    daysRatio: number;
  };
}

export interface SystemStats {
  totalFiles: number;
  totalStorage: number; // w bajtach
  totalUsers: number;
  recentActivity: number;
  systemStatus: {
    cloudflare: boolean;
    firebase: boolean;
    api: boolean;
  };
  recentFiles: Array<{
    name: string;
    size: number;
    uploadedAt: string;
  }>;
}


