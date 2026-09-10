import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { welcomeUserEmail } from '../mail/templates/welcome-user.template';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthenticatedUser } from '../auth/jwt-payload.interface';

const USER_SELECT = {
  user_id: true,
  email: true,
  name: true,
  is_active: true,
  must_change_password: true,
  totp_enabled: true,
  created_at: true,
  roles: { select: { role_id: true, name: true, level: true } },
} as const;

/**
 * Administracion de cuentas — crear con cualquier rol permitido, cambiar
 * rol, activar/desactivar. Nunca borra (desactivar preserva el historial).
 * Toda asignacion de rol pasa por `assertCanManageRole`: el actor solo
 * asigna un rol de nivel ESTRICTAMENTE MENOR al suyo, y nunca excede el
 * `max_count`. Portado de OmniUser sin cambios.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  findAll() {
    return this.prisma.users.findMany({ select: USER_SELECT, orderBy: { created_at: 'desc' } });
  }

  /**
   * Crea una cuenta con contrasena temporal generada por el sistema y manda
   * el correo de bienvenida. Si el correo falla, la contrasena temporal se
   * regresa en la respuesta (unica oportunidad de comunicarla).
   * @throws {ConflictException} si el correo ya existe, o si el rol alcanzo su `max_count`.
   * @throws {ForbiddenException} si `actor` intenta asignar un rol de su nivel o superior.
   */
  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<{ user_id: string; email: string; welcome_email_sent: boolean; temp_password?: string }> {
    await this.assertCanManageRole(actor, dto.role_id);

    const existing = await this.prisma.users.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Ese correo ya esta registrado');

    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const created = await this.prisma.users.create({
      data: { email: dto.email, name: dto.name, password_hash: passwordHash, role_id: dto.role_id, must_change_password: true },
    });

    const { subject, html } = welcomeUserEmail({
      name: dto.name ?? null,
      email: dto.email,
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
    });
    const sent = await this.mail.send({ to: dto.email, subject, html });

    return { user_id: created.user_id, email: created.email, welcome_email_sent: sent, temp_password: sent ? undefined : tempPassword };
  }

  /**
   * @throws {NotFoundException} si la cuenta no existe.
   * @throws {ConflictException} si `dto.role_id` alcanzo su `max_count`.
   * @throws {ForbiddenException} si `actor` intenta asignar un rol de su nivel/superior, o editar una cuenta de nivel igual/superior al suyo.
   */
  async update(userId: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const existing = await this.prisma.users.findUnique({ where: { user_id: userId }, include: { roles: { select: { level: true } } } });
    if (!existing) throw new NotFoundException('Cuenta no encontrada');

    if (existing.roles.level >= actor.roleLevel) {
      throw new ForbiddenException('No puedes gestionar una cuenta de tu mismo nivel o superior');
    }
    if (dto.role_id !== undefined) {
      await this.assertCanManageRole(actor, dto.role_id, userId);
    }

    return this.prisma.users.update({
      where: { user_id: userId },
      data: { role_id: dto.role_id, is_active: dto.is_active },
      select: USER_SELECT,
    });
  }

  /**
   * @param excludeUserId Al reasignar el rol de una cuenta existente, no cuenta contra su propio `max_count`.
   */
  private async assertCanManageRole(actor: AuthenticatedUser, roleId: number, excludeUserId?: string): Promise<void> {
    const role = await this.prisma.roles.findUniqueOrThrow({ where: { role_id: roleId } });

    if (role.level >= actor.roleLevel) {
      throw new ForbiddenException(`No puedes asignar el rol "${role.name}" — es de tu mismo nivel o superior`);
    }

    if (role.max_count !== null) {
      const activeCount = await this.prisma.users.count({
        where: { role_id: roleId, is_active: true, user_id: excludeUserId ? { not: excludeUserId } : undefined },
      });
      if (activeCount >= role.max_count) {
        throw new ConflictException(`Ya hay ${activeCount} cuenta(s) activa(s) con el rol "${role.name}" — es un cargo de maximo ${role.max_count}`);
      }
    }
  }
}
