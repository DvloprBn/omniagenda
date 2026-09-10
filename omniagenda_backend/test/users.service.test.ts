import { Test } from '@nestjs/testing';
import { UsersService } from '../src/users/users.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import type { AuthenticatedUser } from '../src/auth/jwt-payload.interface';

/**
 * Integracion real — `PrismaService` real; solo `MailService` es stub.
 * Prueba `assertCanManageRole`: jerarquia + `max_count`. Portado de OmniUser.
 */
describe('UsersService (integracion, Postgres real)', () => {
  let service: UsersService;
  let prisma: PrismaService;
  const testEmails: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      providers: [UsersService, PrismaService, { provide: MailService, useValue: { send: async () => true } }],
    }).compile();
    service = mod.get(UsersService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (testEmails.length) {
      await prisma.refresh_tokens.deleteMany({ where: { users: { email: { in: testEmails } } } });
      await prisma.users.deleteMany({ where: { email: { in: testEmails } } });
    }
    await prisma.$disconnect();
  });

  const roleId = async (name: string) => (await prisma.roles.findUniqueOrThrow({ where: { name } })).role_id;
  const actor = (role: string, roleLevel: number): AuthenticatedUser => ({ userId: 'actor-test', role, roleLevel, mustChangePassword: false });

  it('admin (nivel 3) NO puede crear una cuenta con rol director (nivel 4)', async () => {
    const email = `test.director.${Date.now()}@example.com`;
    await expect(service.create({ email, role_id: await roleId('director') }, actor('admin', 3))).rejects.toThrow(/mismo nivel o superior/);
    expect(await prisma.users.findUnique({ where: { email } })).toBeNull();
  });

  it('admin (nivel 3) SI puede crear una cuenta con rol manager (nivel 2)', async () => {
    const email = `test.manager.${Date.now()}@example.com`;
    testEmails.push(email);
    const created = await service.create({ email, role_id: await roleId('manager') }, actor('admin', 3));
    expect(created.email).toBe(email);
  });

  it('respeta max_count: rechaza un segundo director si ya hay 1 activo', async () => {
    const directorRoleId = await roleId('director');
    const activos = await prisma.users.count({ where: { role_id: directorRoleId, is_active: true } });
    const email = `test.director2.${Date.now()}@example.com`;
    if (activos >= 1) {
      await expect(service.create({ email, role_id: directorRoleId }, actor('super', 5))).rejects.toThrow(/cargo de maximo/);
      expect(await prisma.users.findUnique({ where: { email } })).toBeNull();
    } else {
      testEmails.push(email);
      const created = await service.create({ email, role_id: directorRoleId }, actor('super', 5));
      expect(created.email).toBe(email);
    }
  });

  it('bloquea gestionar una cuenta de nivel igual/superior al del actor', async () => {
    const superUser = await prisma.users.findFirstOrThrow({ where: { roles: { name: 'super' } } });
    await expect(service.update(superUser.user_id, { is_active: false }, actor('admin', 3))).rejects.toThrow(/mismo nivel o superior/);
    expect((await prisma.users.findUniqueOrThrow({ where: { user_id: superUser.user_id } })).is_active).toBe(true);
  });
});
