import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Define respuesta base (dejar pasar la petición)
  const response = NextResponse.next();

  // --- CONFIGURACIÓN CORS ---
  // 1. Permitir origen (En producción deberías poner tu dominio real en lugar de '*')
  response.headers.set('Access-Control-Allow-Origin', '*'); 
  
  // 2. Métodos permitidos
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // 3. Headers permitidos (Importante incluir Authorization para tu JWT)
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 4. Max Age (Cachear la respuesta del preflight)
  response.headers.set('Access-Control-Max-Age', '86400');

  // --- MANEJO DE PREFLIGHT (OPTIONS) ---
  // Si es una petición OPTIONS, devolvemos OK inmediatamente con los headers
  if (request.method === 'OPTIONS') {
    return NextResponse.json({}, { headers: response.headers });
  }

  return response;
}

// Configuración: Aplicar middleware solo a las rutas de la API
export const config = {
  matcher: '/api/:path*',
};
