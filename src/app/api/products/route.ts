import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';
import { secureHandler } from '@/utils/api-wrapper';

// GET: Todos (Admin, Editor, Viewer)
export async function GET(req: Request) {
  return secureHandler(req, async () => {
    const products = await ProductService.getAll();
    return NextResponse.json(products);
  }, ['ADMIN', 'EDITOR', 'VIEWER']);
}

// POST: Solo Admin y Editor
export async function POST(req: Request) {
  return secureHandler(req, async (userId, role, body) => {
    const product = await ProductService.create(body);
    return NextResponse.json(product);
  }, ['ADMIN', 'EDITOR']);
}