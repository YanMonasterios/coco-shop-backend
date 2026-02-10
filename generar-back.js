const fs = require('fs');
const path = require('path');

// Función auxiliar para crear archivos y carpetas
const createFile = (filePath, content) => {
  const absolutePath = path.join(__dirname, filePath);
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absolutePath, content.trim());
  console.log(`✅ Creado: ${filePath}`);
};

// --- 1. DEFINICIÓN DE BASE DE DATOS (PRISMA) ---
createFile('prisma/schema.prisma', `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

model User {
  id             Int       @id @default(autoincrement())
  email          String    @unique
  password       String
  name           String
  role           Role      @default(VIEWER)
  mustChangePass Boolean   @default(true)
  
  // Seguridad: Bloqueo
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model ProductType {
  id        Int       @id @default(autoincrement())
  name      String
  products  Product[]
}

model Product {
  id          Int         @id @default(autoincrement())
  name        String
  expiration  DateTime
  createdAt   DateTime    @default(now())
  
  typeId      Int
  type        ProductType @relation(fields: [typeId], references: [id])
}
`);

// --- 2. LIBRERÍAS CORE (DB, JWT, HASH) ---

createFile('src/lib/db.ts', `
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`);

createFile('src/lib/jwt.ts', `
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'super-secreto-cocos';

export const signToken = (payload: any) => jwt.sign(payload, SECRET, { expiresIn: '8h' });
export const verifyToken = (token: string) => {
  try { return jwt.verify(token, SECRET); } catch { return null; }
};
`);

// --- 3. SERVICIOS (LÓGICA DE NEGOCIO PURA) ---

createFile('src/services/auth.service.ts', `
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
      throw new Error(\`Usuario bloqueado. Espera \${wait} segundos.\`);
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
        throw new Error(\`Contraseña incorrecta. Intento \${attempts} de 3.\`);
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
`);

createFile('src/services/product.service.ts', `
import { prisma } from '@/lib/db';

export class ProductService {
  static async getAll() {
    return prisma.product.findMany({ 
      include: { type: true },
      orderBy: { createdAt: 'desc' } 
    });
  }

  static async create(data: any) {
    return prisma.product.create({
      data: {
        name: data.name,
        expiration: new Date(data.expiration),
        typeId: Number(data.typeId)
      }
    });
  }
}
`);

// --- 4. MIDDLEWARE WRAPPER (SEGURIDAD Y ROLES) ---

createFile('src/utils/api-wrapper.ts', `
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
`);

// --- 5. CONTROLADORES (API ROUTES) ---

// Login
createFile('src/app/api/auth/login/route.ts', `
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await AuthService.login(body.email, body.password);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
`);

// Change Password
createFile('src/app/api/auth/change-password/route.ts', `
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
`);

// Productos (GET y POST)
createFile('src/app/api/products/route.ts', `
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
`);

// --- 6. SEED (DATOS INICIALES) ---
createFile('prisma/seed.ts', `
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Crear Tipos de Coco
  await prisma.productType.createMany({
    data: [
      { name: 'Coco Fresco' },
      { name: 'Coco Seco' },
      { name: 'Agua de Coco' }
    ],
    skipDuplicates: true
  });

  // Crear Usuario Admin Inicial
  const hashed = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cocos.com' },
    update: {},
    create: {
      email: 'admin@cocos.com',
      name: 'Administrador Principal',
      password: hashed,
      role: 'ADMIN',
      mustChangePass: true // Obligado a cambiar pass
    }
  });

  console.log('🌱 Base de datos sembrada. Usuario: admin@cocos.com / Pass: admin123');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
`);

console.log('🚀 Backend Generado Exitosamente. Sigue los pasos finales en el chat.');



// Asegúrate de tener un archivo .env configurado con tu base de datos PostgreSQL:

DATABASE_URL="postgresql://usuario:password@localhost:5432/cocos_db?schema=public"
JWT_SECRET="mi_secreto_super_seguro"
