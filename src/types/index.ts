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


