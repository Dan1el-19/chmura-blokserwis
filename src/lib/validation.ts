import { z } from 'zod';



export const deleteSchema = z.object({
  key: z.string().min(1)
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(200).optional(),
  role: z.enum(['basic', 'plus', 'admin']).optional(),
  storageLimitGb: z.number().int().positive().max(1024).optional(),
  password: z.string().min(6).max(256).optional()
});

export const adminUpdateUserSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(['basic', 'plus', 'admin']).optional(),
  storageLimit: z.number().int().positive().max(1024 * 1024 * 1024 * 1024).optional() // bytes
});

export const adminPasswordSchema = z.object({
  uid: z.string().min(1),
  password: z.string().min(6).max(256).optional()
});

export const shareSchema = z.object({
  key: z.string().min(1),
  expiresIn: z.number().int().positive().max(30 * 24 * 3600).optional(), // max 30 dni
  expiresAt: z.union([z.string(), z.date()]).optional(),
  name: z.string().max(120).optional()
});

export const downloadSchema = z.object({
  key: z.string().min(1)
});


