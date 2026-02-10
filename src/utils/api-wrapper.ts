import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function secureHandler(
  req: Request,
  handler: (userId: number, role: string, body?: any) => Promise<NextResponse>,
  allowedRoles: string[] = [] // Si está vacío, permite a todos los logueados
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.split(' ')[1];
    const decoded: any = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Bloqueo si debe cambiar contraseña (excepto si la ruta es cambiar contraseña)
    if (decoded.mustChangePass && !req.url.includes('/change-password')) {
      return NextResponse.json({ error: 'Debes cambiar tu contraseña obligatoriamente' }, { status: 403 });
    }

    // Validación de Roles
    if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    // Parse Body si es POST/PUT
    let body = null;
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch {}
    }

    return await handler(decoded.id, decoded.role, body);

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}