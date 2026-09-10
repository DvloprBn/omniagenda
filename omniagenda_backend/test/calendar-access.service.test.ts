import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { CalendarAccessService } from '../src/calendar-access/calendar-access.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthenticatedUser } from '../src/auth/jwt-payload.interface';

/**
 * Integracion real — la matriz de permisos POR CALENDARIO, el aporte de
 * OmniAgenda sobre el RBAC global de OmniUser. Sin equivalente en OmniUser.
 */
describe('CalendarAccessService (integracion, Postgres real)', () => {
  let svc: CalendarAccessService;
  let prisma: PrismaService;
  let privateCalId = '';
  let publicCalId = '';
  let memberUserId = '';
  const cleanup: { calIds: string[]; userIds: string[] } = { calIds: [], userIds: [] };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [CalendarAccessService, PrismaService] }).compile();
    svc = mod.get(CalendarAccessService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();

    const priv = await prisma.calendars.create({ data: { name: 'test-priv', timezone: 'America/Mexico_City', visibility: 'private' } });
    const pub = await prisma.calendars.create({ data: { name: 'test-pub', timezone: 'America/Mexico_City', visibility: 'public' } });
    privateCalId = priv.calendar_id;
    publicCalId = pub.calendar_id;
    cleanup.calIds.push(privateCalId, publicCalId);

    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const u = await prisma.users.create({ data: { email: `cal.test.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    memberUserId = u.user_id;
    cleanup.userIds.push(memberUserId);

    await prisma.calendar_members.create({ data: { calendar_id: privateCalId, user_id: memberUserId, calendar_role: 'booker', granted_by: 'test' } });
  });

  afterAll(async () => {
    await prisma.calendar_members.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.calendars.deleteMany({ where: { calendar_id: { in: cleanup.calIds } } });
    await prisma.users.deleteMany({ where: { user_id: { in: cleanup.userIds } } });
    await prisma.$disconnect();
  });

  const user = (role: string, userId = 'global-actor'): AuthenticatedUser => ({ userId, role, roleLevel: 0, mustChangePassword: false });

  it('un rol global admin es manager IMPLICITO en cualquier calendario', async () => {
    expect(await svc.effectiveRole(user('admin'), privateCalId)).toBe('manager');
    await expect(svc.assertCalendarAccess(user('super'), privateCalId, 'manager')).resolves.toBeUndefined();
  });

  it('un miembro "booker" cubre "viewer" y "booker", pero NO "manager"', async () => {
    const u = user('usuario', memberUserId);
    expect(await svc.effectiveRole(u, privateCalId)).toBe('booker');
    await expect(svc.assertCalendarAccess(u, privateCalId, 'viewer')).resolves.toBeUndefined();
    await expect(svc.assertCalendarAccess(u, privateCalId, 'booker')).resolves.toBeUndefined();
    await expect(svc.assertCalendarAccess(u, privateCalId, 'manager')).rejects.toThrow(/permiso "manager"/);
  });

  const OUTSIDER = randomUUID(); // user.userId siempre es un UUID real (sub del JWT)

  it('un NO miembro no tiene acceso a un calendario "private"', async () => {
    const u = user('usuario', OUTSIDER);
    expect(await svc.effectiveRole(u, privateCalId)).toBeNull();
    await expect(svc.assertCalendarAccess(u, privateCalId, 'viewer')).rejects.toThrow(/permiso "viewer"/);
  });

  it('allowByVisibility: un NO miembro SI puede LEER un calendario "public", pero no escribir', async () => {
    const u = user('usuario', OUTSIDER);
    await expect(svc.assertCalendarAccess(u, publicCalId, 'viewer', { allowByVisibility: true })).resolves.toBeUndefined();
    await expect(svc.assertCalendarAccess(u, publicCalId, 'booker', { allowByVisibility: true })).rejects.toThrow(/permiso "booker"/);
  });

  it('assertCalendarAccess sobre un calendario inexistente -> NotFound', async () => {
    await expect(
      svc.assertCalendarAccess(user('admin'), '00000000-0000-4000-8000-999999999999', 'viewer'),
    ).rejects.toThrow(/no encontrado/i);
  });

  it('grant desde un no-manager del calendario es rechazado', async () => {
    await expect(svc.grant(user('usuario', memberUserId), privateCalId, randomUUID(), 'viewer')).rejects.toThrow(/permiso "manager"/);
  });

  it('grant desde un admin global crea la membresia; revoke la quita', async () => {
    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const target = await prisma.users.create({ data: { email: `cal.grant.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    cleanup.userIds.push(target.user_id);

    await svc.grant(user('admin'), privateCalId, target.user_id, 'viewer');
    expect(await svc.effectiveRole(user('usuario', target.user_id), privateCalId)).toBe('viewer');

    await svc.revoke(user('admin'), privateCalId, target.user_id);
    expect(await svc.effectiveRole(user('usuario', target.user_id), privateCalId)).toBeNull();
  });
});
