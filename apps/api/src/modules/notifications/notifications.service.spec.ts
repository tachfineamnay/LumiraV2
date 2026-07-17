import { ConfigService } from '@nestjs/config';
import { NotificationType, Order, User } from '@prisma/client';
import { NotificationsService } from './notifications.service';

const order = {
  id: 'order-1',
  orderNumber: 'LUM-2026-001',
} as Order;

const user = {
  id: 'user-1',
  email: 'client@oraclelumira.com',
  firstName: 'Léa',
} as User;

function createService() {
  const emailService = {
    send: jest.fn(),
    sendOrThrow: jest.fn().mockResolvedValue(undefined),
  };
  const prisma = {
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    },
  };
  const configService = {
    get: jest.fn((key: string) => key === 'WEB_URL' ? 'https://oraclelumira.com' : undefined),
  } as unknown as ConfigService;

  return {
    service: new NotificationsService(emailService as never, prisma as never, configService),
    emailService,
    prisma,
  };
}

describe('NotificationsService expert validation', () => {
  it('sends a traceable email before creating the in-app notification', async () => {
    const { service, emailService, prisma } = createService();

    await service.sendExpertValidation(order, user, 'Maya');

    expect(emailService.sendOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      to: user.email,
      messageId: '<lumira-delivery-order-1@oraclelumira.com>',
      context: expect.objectContaining({
        sanctuaireLink: 'https://oraclelumira.com/sanctuaire',
      }),
    }));
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        type: NotificationType.EXPERT_VALIDATION,
      }),
    });
  });

  it('does not claim an in-app delivery when SMTP fails', async () => {
    const { service, emailService, prisma } = createService();
    emailService.sendOrThrow.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await expect(service.sendExpertValidation(order, user, 'Maya'))
      .rejects.toThrow('SMTP unavailable');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
