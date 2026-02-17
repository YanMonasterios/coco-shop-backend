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

  static async delete(id: number) {
    return prisma.product.delete({
      where: { id }
    });
  }
}
