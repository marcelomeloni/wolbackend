import axios from 'axios';
import { env, integrationFlags, shippingProvider } from '../../lib/env';
import { supabase } from '../../lib/supabase';
import { AppError } from '../../middlewares/errorHandler';
import { z } from 'zod';
import { shippingQuoteSchema } from './shipping.schema';

export interface ShippingOption {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryTime: number;
}

// Dimensões/peso padrão quando o produto não define os seus.
const DEFAULT_WEIGHT_KG = 0.3;
const DEFAULT_DIMENSIONS = { height: 5, width: 20, length: 30 };

function isValidCep(cep: string) {
  return /^\d{8}$/.test(cep);
}

export class ShippingService {
  private static client() {
    return axios.create({
      baseURL: env.MELHORENVIO_BASE_URL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MELHORENVIO_TOKEN}`,
        'User-Agent': 'WOL Store (contato@wearwol.com)',
      },
      timeout: 15000,
    });
  }

  // Monta a lista de volumes a partir dos itens do carrinho usando peso/dimensões do produto.
  private static async buildVolumes(items: Array<{ productId: string; quantity: number }>) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    if (productIds.length === 0) return [];

    const { data: products } = await supabase
      .from('products')
      .select('id, weight_kg, height_cm, width_cm, length_cm')
      .in('id', productIds);

    const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

    return items.map((item, idx) => {
      const p: any = byId.get(item.productId);
      return {
        id: String(idx + 1),
        weight: Number(p?.weight_kg ?? DEFAULT_WEIGHT_KG),
        height: Number(p?.height_cm ?? DEFAULT_DIMENSIONS.height),
        width: Number(p?.width_cm ?? DEFAULT_DIMENSIONS.width),
        length: Number(p?.length_cm ?? DEFAULT_DIMENSIONS.length),
        quantity: Math.max(1, item.quantity),
      };
    });
  }

  static async quote(
    data: z.infer<typeof shippingQuoteSchema>,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{ origin: string; destination: string; options: ShippingOption[] }> {
    if (!isValidCep(data.zipCode)) {
      throw new AppError('CEP de destino inválido', 400, 'INVALID_CEP');
    }

    const origin = env.SHIPPING_ORIGIN_CEP.replace(/\D/g, '');

    // Sem integração configurada (ou em modo demo): devolve opções estáticas
    // para não travar o checkout.
    if (shippingProvider === 'mock' || !integrationFlags.melhorEnvio || !isValidCep(origin)) {
      return {
        origin,
        destination: data.zipCode,
        options: [
          { id: 'PAC', name: 'PAC', company: 'Correios', price: 24.9, deliveryTime: 8 },
          { id: 'SEDEX', name: 'SEDEX', company: 'Correios', price: 39.9, deliveryTime: 3 },
        ],
      };
    }

    const volumes = await this.buildVolumes(items);
    const payload = {
      from: { postal_code: origin },
      to: { postal_code: data.zipCode },
      products: volumes.map((v) => ({
        id: v.id,
        width: v.width,
        height: v.height,
        length: v.length,
        weight: v.weight,
        insurance_value: 0,
        quantity: v.quantity,
      })),
      options: { receipt: false, own_hand: false },
    };

    try {
      const { data: result } = await this.client().post('/api/v2/me/shipment/calculate', payload);

      const options: ShippingOption[] = (Array.isArray(result) ? result : [])
        .filter((s: any) => !s.error && s.price)
        .map((s: any) => ({
          id: String(s.id),
          name: s.name,
          company: s.company?.name ?? '',
          price: Number(s.custom_price ?? s.price),
          deliveryTime: Number(s.custom_delivery_time ?? s.delivery_time ?? 0),
        }))
        .sort((a, b) => a.price - b.price);

      if (options.length === 0) {
        throw new AppError('Nenhuma opção de frete disponível para este CEP', 422, 'NO_SHIPPING_OPTIONS');
      }

      return { origin, destination: data.zipCode, options };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Falha ao consultar o frete. Tente novamente.', 502, 'SHIPPING_PROVIDER_ERROR');
    }
  }
}
