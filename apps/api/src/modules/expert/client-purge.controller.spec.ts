import 'reflect-metadata';
import { ROLES_KEY } from './decorators/roles.decorator';
import { ClientPurgeController } from './client-purge.controller';

describe('ClientPurgeController authorization', () => {
  it('requires the ADMIN role on the destructive purge endpoint', () => {
    const handler = ClientPurgeController.prototype.purge;
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
  });
});
