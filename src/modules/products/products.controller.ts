import { Request, Response } from 'express';
import { ProductsService } from './products.service';
import { createProductFullSchema, productVariantSchema, productImageSchema, productSchema } from './products.schema';

export class ProductsController {
  static async create(req: Request, res: Response) {
    try {
      const data = createProductFullSchema.parse(req.body);
      const product = await ProductsService.createProduct(data);
      res.status(201).json(product);
    } catch (error: any) {
      if (error.message === 'SLUG_ALREADY_EXISTS') {
        res.status(409).json({ error: { code: 'SLUG_ALREADY_EXISTS', message: 'Slug já está em uso' } });
      } else {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
      }
    }
  }

  static async uploadFile(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado' } });
      }
      const fileUrl = await ProductsService.uploadImage(req.file);
      res.status(200).json({ url: fileUrl });
    } catch (error: any) {
      res.status(500).json({ error: { code: 'UPLOAD_ERROR', message: error.message } });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const products = await ProductsService.getProducts(req.query);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async getBySlug(req: Request, res: Response) {
    try {
      const product = await ProductsService.getProductBySlug(req.params.slug as string);
      if (!product) {
        res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Produto não encontrado' } });
        return;
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const data = productSchema.parse(req.body);
      const product = await ProductsService.updateProduct(req.params.id as string as string, data);
      res.json(product);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.errors || error.message } });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await ProductsService.deleteProduct(req.params.id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  // --- VARIANTS ---
  static async addVariant(req: Request, res: Response) {
    try {
      const data = productVariantSchema.parse(req.body);
      const variant = await ProductsService.addVariant(req.params.id as string, data);
      res.status(201).json(variant);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async deleteVariant(req: Request, res: Response) {
    try {
      await ProductsService.deleteVariant(req.params.id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  // --- IMAGES ---
  static async addImage(req: Request, res: Response) {
    try {
      const data = productImageSchema.parse(req.body);
      const image = await ProductsService.addImage(req.params.id as string, data);
      res.status(201).json(image);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async deleteImage(req: Request, res: Response) {
    try {
      await ProductsService.deleteImage(req.params.id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  // --- COLORS ---
  static async addColor(req: Request, res: Response) {
    try {
      const data = productColorSchema.parse(req.body);
      const color = await ProductsService.addColor(req.params.id as string, data);
      res.status(201).json(color);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async deleteColor(req: Request, res: Response) {
    try {
      await ProductsService.deleteColor(req.params.id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }

  // --- SIZES ---
  static async addSize(req: Request, res: Response) {
    try {
      const data = productSizeSchema.parse(req.body);
      const size = await ProductsService.addSize(req.params.id as string, data);
      res.status(201).json(size);
    } catch (error: any) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
  }

  static async deleteSize(req: Request, res: Response) {
    try {
      await ProductsService.deleteSize(req.params.id as string);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: error.message } });
    }
  }
}
