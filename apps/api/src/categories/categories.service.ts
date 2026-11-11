import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { categories } from '../db/schema.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './categories.dto.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.select().from(categories).orderBy(asc(categories.type), asc(categories.name), asc(categories.id));
  }

  async create(dto: CreateCategoryDto) {
    try {
      const [row] = await this.db.insert(categories).values(dto).returning();
      return row;
    } catch (e) {
      throw this.mapError(e);
    }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    try {
      const [row] = await this.db.update(categories).set(dto).where(eq(categories.id, id)).returning();
      if (!row) throw new NotFoundException('Categoria não encontrada');
      return row;
    } catch (e) {
      throw this.mapError(e);
    }
  }

  private mapError(e: unknown) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === UNIQUE_VIOLATION) return new ConflictException('Já existe uma categoria com esse nome');
    return e;
  }
}
