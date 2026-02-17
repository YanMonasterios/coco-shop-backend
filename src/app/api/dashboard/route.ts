import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { secureHandler } from '@/utils/api-wrapper';

export async function GET(req: Request) {
  return secureHandler(req, async () => {
    
    // 1. Contar Total de Productos
    const totalProducts = await prisma.product.count();

    // 2. Contar Total de Usuarios
    const totalUsers = await prisma.user.count();

    // 3. Calcular Inventario por Tipo (Para la gráfica)
    // Usamos Prisma para agrupar y contar automáticamente
    const productsByType = await prisma.productType.findMany({
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    // Formateamos para que el Frontend lo entienda fácil: { label: "Coco Seco", value: 10 }
    const chartData = productsByType.map(type => ({
      label: type.name,
      value: type._count.products
    }));

    return NextResponse.json({
      totalProducts,
      totalUsers,
      chartData
    });

  }, ['ADMIN', 'EDITOR', 'VIEWER']);
}

