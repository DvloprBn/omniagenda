import { Test } from '@nestjs/testing';
import { RolesService } from '../src/roles/roles.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/auth/jwt-payload.interface';

/**
 * Integracion real — `PrismaService` real contra el Postgres de desarrollo,
 * sin mocks. Regla de jerarquia: un rol nuevo/editado nunca termina con
 * mas autoridad (`level`) que quien lo crea; un rol `is_system` nunca
 * pierde su `level`/`max_count` por esta via. Portado de OmniUser.
 */
describe('RolesService (integracion, Postgres real)', () => {
  let service: RolesService;
  let prisma: PrismaService;
  const testRoleIds: number[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [RolesService, PrismaService] }).compile();
    service = mod.get(RolesService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    if (testRoleIds.length) await prisma.roles.deleteMany({ where: { role_id: { in: testRoleIds } } });
    await prisma.$disconnect();
  });

  const actor = (role: string, roleLevel: number): AuthenticatedUser => ({ userId: 'actor-test', role, roleLevel, mustChangePassword: false });

  it('admin (nivel 3) NO puede crear un rol de nivel 3 (igual al suyo)', async () => {
    const name = `test_igual_${Date.now()}`;
    await expect(service.create({ name, level: 3 }, actor('admin', 3))).rejects.toThrow(/mismo nivel o superior/);
    expect(await prisma.roles.findUnique({ where: { name } })).toBeNull();
  });

  it('admin (nivel 3) SI puede crear un rol de nivel 1 (estrictamente menor)', async () => {
    const name = `test_menor_${Date.now()}`;
    const created = await service.create({ name, level: 1 }, actor('admin', 3));
    testRoleIds.push(created.role_id);
    expect(created.level).toBe(1);
    expect(created.is_system).toBe(false);
  });

  it('un rol sin level explicito recibe el default 0', async () => {
    const name = `test_sinlevel_${Date.now()}`;
    const created = await service.create({ name }, actor('super', 5));
    testRoleIds.push(created.role_id);
    expect(created.level).toBe(0);
  });

  it('rechaza cambiar el level de un rol is_system (staff, sembrado)', async () => {
    const staff = await prisma.roles.findUniqueOrThrow({ where: { name: 'staff' } });
    await expect(service.update(staff.role_id, { level: 2 }, actor('super', 5))).rejects.toThrow(/no se pueden cambiar/);
    expect((await prisma.roles.findUniqueOrThrow({ where: { role_id: staff.role_id } })).level).toBe(1);
  });

  it('super (nivel 5) no puede editar un rol dejandolo en nivel 5', async () => {
    const name = `test_editar_${Date.now()}`;
    const created = await service.create({ name, level: 2 }, actor('admin', 3));
    testRoleIds.push(created.role_id);
    await expect(service.update(created.role_id, { level: 5 }, actor('super', 5))).rejects.toThrow(/mismo nivel o superior/);
    expect((await prisma.roles.findUniqueOrThrow({ where: { role_id: created.role_id } })).level).toBe(2);
  });
});
