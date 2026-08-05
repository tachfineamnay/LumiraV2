import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsDeliveryService, computeNextAttemptAt } from './analytics-delivery.service';
import { Ga4MeasurementProtocolService } from './ga4-measurement-protocol.service';
import { AnalyticsDeliveryStatus, Order } from '@prisma/client';

describe('AnalyticsDeliveryService', () => {
  let service: AnalyticsDeliveryService;
  let prismaService: PrismaService;
  let ga4Service: Ga4MeasurementProtocolService;

  function getMockOrder(): Order {
    return {
      id: 'ord_123',
      orderNumber: 'LUM-12345',
      userId: 'user_123',
      userEmail: 'client@example.com',
      userName: 'Test User',
      amount: 1700,
      currency: 'eur',
      status: 'PAID',
      paymentIntentId: 'pi_3MtwBw',
      checkoutAttemptId: 'attempt_123',
      stripeSessionId: null,
      paidAt: new Date('2026-08-05T10:00:00Z'),
      formData: {},
      clientInputs: null,
      intakeRequired: true,
      expertPrompt: null,
      expertInstructions: null,
      generatedContent: null,
      errorLog: null,
      expertReview: null,
      expertValidation: null,
      revisionCount: 0,
      deliveredAt: null,
      deliveryMethod: null,
      subscriptionId: null,
      addons: null,
      upsellOfferedAt: null,
      analyticsConsentGranted: true,
      ga4ClientId: '12345.67890',
      ga4SessionId: '99999',
      ga4ContextCapturedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsDeliveryService,
        {
          provide: PrismaService,
          useValue: {
            analyticsDelivery: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            order: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: Ga4MeasurementProtocolService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(true),
            sendGa4Event: jest.fn().mockResolvedValue({ success: true, status: 204 }),
          },
        },
      ],
    }).compile();

    service = module.get<AnalyticsDeliveryService>(AnalyticsDeliveryService);
    prismaService = module.get<PrismaService>(PrismaService);
    ga4Service = module.get<Ga4MeasurementProtocolService>(Ga4MeasurementProtocolService);
    jest.clearAllMocks();
  });

  describe('computeNextAttemptAt', () => {
    it('calculates exponential backoff correctly', () => {
      const now = new Date('2026-08-05T12:00:00Z');
      const t1 = computeNextAttemptAt(1, now);
      expect(t1).toEqual(new Date('2026-08-05T12:01:00Z'));

      const t2 = computeNextAttemptAt(2, now);
      expect(t2).toEqual(new Date('2026-08-05T12:05:00Z'));

      const t8 = computeNextAttemptAt(8, now);
      expect(t8).toBeNull();
    });
  });

  describe('recordPurchase', () => {
    it('creates SKIPPED delivery when consent is false', async () => {
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.analyticsDelivery.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: 'del_1', ...args.data }),
      );

      const noConsentOrder = { ...getMockOrder(), analyticsConsentGranted: false };
      const res = await service.recordPurchase(noConsentOrder, 'pi_3MtwBw');

      expect(res.status).toBe(AnalyticsDeliveryStatus.SKIPPED);
      expect(res.skippedReason).toBe('no_consent');
    });

    it('creates SKIPPED delivery when clientId is missing', async () => {
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.analyticsDelivery.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: 'del_1', ...args.data }),
      );

      const noClientOrder = { ...getMockOrder(), ga4ClientId: null };
      const res = await service.recordPurchase(noClientOrder, 'pi_3MtwBw');

      expect(res.status).toBe(AnalyticsDeliveryStatus.SKIPPED);
      expect(res.skippedReason).toBe('no_client_id');
    });

    it('creates PENDING delivery with Measurement Protocol payload when consented', async () => {
      (prismaService.analyticsDelivery.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: 'del_1', ...args.data }),
      );
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockImplementation(({ where }) => {
        if (where?.id === 'del_1') {
          return Promise.resolve({
            id: 'del_1',
            eventKey: 'ga4:purchase:pi_3MtwBw',
            payload: { client_id: '12345.67890', events: [] },
            attempts: 0,
          });
        }
        return Promise.resolve(null);
      });

      const res = await service.recordPurchase(getMockOrder(), 'pi_3MtwBw');
      expect(res.eventKey).toBe('ga4:purchase:pi_3MtwBw');
      expect(prismaService.analyticsDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'ga4:purchase:pi_3MtwBw',
            status: AnalyticsDeliveryStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('recordRefund', () => {
    it('creates ga4:refund eventKey and payload', async () => {
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.order.findFirst as jest.Mock).mockResolvedValue(getMockOrder());
      (prismaService.analyticsDelivery.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: 'del_ref_1', ...args.data }),
      );

      const res = await service.recordRefund('pi_3MtwBw', 're_123', 1700, 'eur');
      expect(res.eventKey).toBe('ga4:refund:re_123');
      expect(prismaService.analyticsDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventKey: 'ga4:refund:re_123',
            eventName: 'refund',
          }),
        }),
      );
    });
  });

  describe('processDelivery', () => {
    it('atomically claims delivery and marks SENT on HTTP success', async () => {
      (prismaService.analyticsDelivery.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockResolvedValue({
        id: 'del_1',
        eventKey: 'ga4:purchase:pi_123',
        payload: { client_id: '123' },
        attempts: 0,
      });
      (ga4Service.sendGa4Event as jest.Mock).mockResolvedValue({ success: true, status: 204 });

      const ok = await service.processDelivery('del_1');
      expect(ok).toBe(true);
      expect(prismaService.analyticsDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del_1' },
        data: expect.objectContaining({
          status: AnalyticsDeliveryStatus.SENT,
        }),
      });
    });

    it('marks FAILED with nextAttemptAt on HTTP error', async () => {
      (prismaService.analyticsDelivery.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.analyticsDelivery.findUnique as jest.Mock).mockResolvedValue({
        id: 'del_1',
        eventKey: 'ga4:purchase:pi_123',
        payload: { client_id: '123' },
        attempts: 0,
      });
      (ga4Service.sendGa4Event as jest.Mock).mockResolvedValue({
        success: false,
        status: 500,
        error: 'Internal Server Error',
      });

      const ok = await service.processDelivery('del_1');
      expect(ok).toBe(false);
      expect(prismaService.analyticsDelivery.update).toHaveBeenCalledWith({
        where: { id: 'del_1' },
        data: expect.objectContaining({
          status: AnalyticsDeliveryStatus.FAILED,
          lastError: 'Internal Server Error',
          attempts: { increment: 1 },
        }),
      });
    });
  });
});
