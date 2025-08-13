import { NextRequest } from 'next/server';
import { GET as downloadGet } from '@/app/api/files/download/route';

// Pretty public route: /files/[slug] -> resolves to presigned URL
export async function GET(request: NextRequest) {
  return downloadGet(request);
}


