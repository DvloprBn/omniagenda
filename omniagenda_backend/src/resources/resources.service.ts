import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

/**
 * Recursos = cosas agendables (persona, sala, equipo, …). Son a nivel
 * SISTEMA, no de un calendario — por eso el control de acceso es por rol
 * global (ver el controller), no por `@CalendarRole`. Nunca se borran:
 * `active=false` preserva el historial de reservas.
 */
@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateResourceDto) {
    return this.prisma.resources.create({ data: { name: dto.name, kind: dto.kind } });
  }

  findAll(includeInactive = false) {
    return this.prisma.resources.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.resources.findUnique({ where: { resource_id: id } });
    if (!r) throw new NotFoundException('Recurso no encontrado');
    return r;
  }

  /**
   * @throws {NotFoundException} si `dto.user_id` no corresponde a ninguna cuenta real.
   * @throws {ConflictException} si esa cuenta ya representa OTRO recurso (`resources.user_id` es `@unique`).
   */
  async update(id: string, dto: UpdateResourceDto) {
    await this.findOne(id);

    if (dto.user_id) {
      const user = await this.prisma.users.findUnique({ where: { user_id: dto.user_id }, select: { user_id: true } });
      if (!user) throw new NotFoundException('La cuenta a vincular no existe');
    }

    try {
      return await this.prisma.resources.update({ where: { resource_id: id }, data: dto });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Esa cuenta ya está vinculada a otro recurso');
      }
      throw e;
    }
  }
}
