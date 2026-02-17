import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { secureHandler } from '@/utils/api-wrapper';

export async function GET(req: Request) {
  // Permitimos que ADMIN, EDITOR y VIEWER vean los tipos para llenar selects o filtros
  return secureHandler(req, async () => {
    const types = await prisma.productType.findMany();
    return NextResponse.json(types);
  }, ['ADMIN', 'EDITOR', 'VIEWER']);
}

