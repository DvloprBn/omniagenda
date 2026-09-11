import { Test } from '@nestjs/testing';
import { ResourcesService } from '../src/resources/resources.service';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Integración real — el vínculo OPCIONAL `resources.user_id` (generaliza
 * `artists.user_id` de Espiral). Sin equivalente en OmniUser: es nuevo de
 * OmniAgenda. Ver DOCUMENTO_VIVO_ARQUITECTURA.md §13.
 */
describe('ResourcesService — vínculo recurso<->cuenta (integración, Postgres real)', () => {
  let service: ResourcesService;
  let prisma: PrismaService;
  const resourceIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [ResourcesService, PrismaService] }).compile();
    service = mod.get(ResourcesService);
    prisma = mod.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.resources.deleteMany({ where: { resource_id: { in: resourceIds } } });
    await prisma.users.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(emailPrefix: string) {
    const role = await prisma.roles.findUniqueOrThrow({ where: { name: 'usuario' } });
    const u = await prisma.users.create({ data: { email: `${emailPrefix}.${Date.now()}@example.com`, password_hash: 'x', role_id: role.role_id } });
    userIds.push(u.user_id);
    return u.user_id;
  }

  it('vincula un recurso a una cuenta real', async () => {
    const created = await service.create({ name: 'test-vinculo', kind: 'person' });
    resourceIds.push(created.resource_id);
    const uid = await makeUser('test.link');

    const updated = await service.update(created.resource_id, { user_id: uid });
    expect(updated.user_id).toBe(uid);
  });

  it('rechaza vincular una cuenta que YA representa otro recurso (unique)', async () => {
    const a = await service.create({ name: 'test-vinculo-a', kind: 'person' });
    const b = await service.create({ name: 'test-vinculo-b', kind: 'person' });
    resourceIds.push(a.resource_id, b.resource_id);
    const uid = await makeUser('test.dup');

    await service.update(a.resource_id, { user_id: uid });
    await expect(service.update(b.resource_id, { user_id: uid })).rejects.toThrow(/ya está vinculada/);
  });

  it('rechaza vincular a una cuenta que no existe', async () => {
    const r = await service.create({ name: 'test-vinculo-404', kind: 'person' });
    resourceIds.push(r.resource_id);
    await expect(service.update(r.resource_id, { user_id: '00000000-0000-4000-8000-999999999999' })).rejects.toThrow(/no existe/);
  });

  it('desvincula mandando user_id: null', async () => {
    const r = await service.create({ name: 'test-desvinculo', kind: 'person' });
    resourceIds.push(r.resource_id);
    const uid = await makeUser('test.unlink');
    await service.update(r.resource_id, { user_id: uid });

    const unlinked = await service.update(r.resource_id, { user_id: null });
    expect(unlinked.user_id).toBeNull();

    // Y esa cuenta queda libre para vincularse a OTRO recurso.
    const r2 = await service.create({ name: 'test-desvinculo-2', kind: 'person' });
    resourceIds.push(r2.resource_id);
    const relinked = await service.update(r2.resource_id, { user_id: uid });
    expect(relinked.user_id).toBe(uid);
  });

  it('borrar la cuenta de login NUNCA borra el recurso (onDelete: SetNull)', async () => {
    const r = await service.create({ name: 'test-setnull', kind: 'person' });
    resourceIds.push(r.resource_id);
    const uid = await makeUser('test.setnull');
    await service.update(r.resource_id, { user_id: uid });

    await prisma.users.delete({ where: { user_id: uid } });
    userIds.splice(userIds.indexOf(uid), 1); // ya no hay que limpiarla, se borró

    const stillThere = await service.findOne(r.resource_id);
    expect(stillThere.user_id).toBeNull();
    expect(stillThere.active).toBe(true);
  });
});
