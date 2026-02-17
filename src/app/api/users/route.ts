import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { secureHandler } from '@/utils/api-wrapper';
import bcrypt from 'bcryptjs';

// GET: Listar usuarios (Solo ADMIN)
export async function GET(req: Request) {
  return secureHandler(req, async () => {
    const users = await prisma.user.findMany({
      // Seleccionamos campos específicos para NO enviar el password al frontend
      select: { 
        id: true, 
        name: true, 
        email: true, 
        role: true, 
        createdAt: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(users);
  }, ['ADMIN']);
}

// POST: Crear usuario (Solo ADMIN)
export async function POST(req: Request) {
  return secureHandler(req, async (userId, role, body) => {
    
    // 1. Validar datos mínimos
    if (!body.email || !body.password || !body.name || !body.role) {
       throw new Error('Faltan datos requeridos (email, password, name, role)');
    }

    // 2. Revisar si el email ya existe
    const existingUser = await prisma.user.findUnique({ where: { email: body.email }});
    if (existingUser) {
        throw new Error('El correo electrónico ya está registrado');
    }

    // 3. Hashear password temporal
    const hashedPassword = await bcrypt.hash(body.password, 10);

    // 4. Crear usuario
    const newUser = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        name: body.name,
        role: body.role, // 'EDITOR', 'VIEWER', 'ADMIN'
        mustChangePass: true // ¡IMPORTANTE! Obligamos al cambio de pass
      }
    });

    // 5. Devolvemos el usuario sin el password
    const { password, ...userWithoutPass } = newUser;
    return NextResponse.json(userWithoutPass);

  }, ['ADMIN']); // Solo ADMIN puede crear
}
