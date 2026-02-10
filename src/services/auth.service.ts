import { prisma } from '@/lib/db';
import { signToken } from '@/lib/jwt';
import bcrypt from 'bcryptjs';

export class AuthService {
  static async login(email: string, pass: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Credenciales inválidas');

    // 1. Verificar Bloqueo
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const wait = Math.ceil((user.lockedUntil.getTime() - new Date().getTime()) / 1000);
      throw new Error(`Usuario bloqueado. Espera ${wait} segundos.`);
    }

    // 2. Verificar Password
    const isValid = await bcrypt.compare(pass, user.password);

    if (!isValid) {
      const attempts = user.failedAttempts + 1;
      // Si falla 3 veces, bloqueo por 1 minuto (60000 ms)
      if (attempts >= 3) {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            lockedUntil: new Date(Date.now() + 60 * 1000), 
            failedAttempts: 0 
          }
        });
        throw new Error('Usuario bloqueado por 1 minuto debido a múltiples intentos fallidos.');
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: attempts }
        });
        throw new Error(`Contraseña incorrecta. Intento ${attempts} de 3.`);
      }
    }

    // 3. Login Exitoso (Resetear contadores)
    await prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null }
    });

    const token = signToken({ 
      id: user.id, 
      role: user.role, 
      mustChangePass: user.mustChangePass 
    });

    return { 
      token, 
      user: { email: user.email, name: user.name, role: user.role }, 
      mustChangePass: user.mustChangePass 
    };
  }

  static async changePassword(userId: number, newPass: string) {
    const hashed = await bcrypt.hash(newPass, 10);
    return prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePass: false }
    });
  }
}