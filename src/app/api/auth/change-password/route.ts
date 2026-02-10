import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { secureHandler } from '@/utils/api-wrapper';

export async function POST(req: Request) {
  return secureHandler(req, async (userId, role, body) => {
    if (!body.newPassword) throw new Error('Contraseña requerida');
    await AuthService.changePassword(userId, body.newPassword);
    return NextResponse.json({ message: 'Contraseña actualizada correctamente' });
  }, []); // Acceso a cualquier usuario logueado
}