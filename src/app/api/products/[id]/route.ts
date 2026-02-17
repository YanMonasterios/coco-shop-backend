import { NextResponse } from 'next/server';
import { ProductService } from '@/services/product.service';
import { secureHandler } from '@/utils/api-wrapper';


export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> } // 1. Definimos params como Promesa
) {
  // 2. Esperamos a que los parámetros se resuelvan
  const params = await props.params;


  return secureHandler(req, async () => {
    const id = Number(params.id);
    
    if (isNaN(id)) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }


    await ProductService.delete(id);
    return NextResponse.json({ message: 'Producto eliminado correctamente' });
    
  }, ['ADMIN', 'EDITOR']);
}
