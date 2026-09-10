import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

/**
 * CRUD del catalogo de roles GLOBAL dinamicos — un rol nuevo se crea sin
 * deploy. Lo que sigue necesitando codigo es que un endpoint lo acepte en
 * su `@Roles(...)`. `create`/`update` validan contra el nivel de quien
 * actua: nadie crea/edita un rol con mas autoridad que la suya. Portado de
 * OmniUser sin cambios.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.roles.findMany({ orderBy: { level: 'desc' } });
  }

  async findOneOrThrow(roleId: number) {
    const role = await this.prisma.roles.findUnique({ where: { role_id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  /** @throws {ForbiddenException} si `dto.level` es igual/mayor al nivel de `actor`. */
  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    const level = dto.level ?? 0;
    if (level >= actor.roleLevel) {
      throw new ForbiddenException('No puedes crear un rol de tu mismo nivel o superior');
    }
    try {
      // is_system SIEMPRE false aqui — los roles del sistema solo se marcan desde el seed.
      return await this.prisma.roles.create({ data: { name: dto.name, description: dto.description, level, max_count: dto.max_count } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw e;
    }
  }

  /**
   * @throws {BadRequestException} si el rol es `is_system` y se intenta cambiar `name`/`level`/`max_count`.
   * @throws {ForbiddenException} si el nuevo `level` es igual/mayor al de `actor`.
   */
  async update(roleId: number, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.findOneOrThrow(roleId);
    if (role.is_system && ((dto.name && dto.name !== role.name) || dto.level !== undefined || dto.max_count !== undefined)) {
      throw new BadRequestException('Este rol es del sistema — su nombre, nivel y tope no se pueden cambiar, solo la descripcion');
    }
    if (dto.level !== undefined && dto.level >= actor.roleLevel) {
      throw new ForbiddenException('No puedes dejar un rol en tu mismo nivel o superior');
    }
    try {
      return await this.prisma.roles.update({
        where: { role_id: roleId },
        data: { name: dto.name, description: dto.description, level: dto.level, max_count: dto.max_count },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
      throw e;
    }
  }

  /**
   * @throws {BadRequestException} si el rol es `is_system` o si tiene cuentas asignadas.
   */
  async remove(roleId: number): Promise<void> {
    const role = await this.prisma.roles.findUnique({ where: { role_id: roleId }, include: { _count: { select: { users: true } } } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.is_system) {
      throw new BadRequestException('Este rol es del sistema — no se puede borrar');
    }
    if (role._count.users > 0) {
      throw new BadRequestException(`Hay ${role._count.users} cuenta(s) con este rol — reasignalas antes de borrarlo`);
    }
    await this.prisma.roles.delete({ where: { role_id: roleId } });
  }
}
