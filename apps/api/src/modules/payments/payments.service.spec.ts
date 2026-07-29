import { ForbiddenException } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';

const CLIENT_SECRET = 'pi_checkout_secret_browser-proof';
const paymentIntent = {
  id: 'pi_checkout',
  client_secret: CLIENT_SECRET,
  status: 'succeeded',
  amount: 1700,
  currency: 'eur',
  customer: null,
  metadata: {
    orderId: 'order_checkout',
    productLevel: 'lumira_early_v1',
    expectedAmount: '1700',
  },
} as unknown as Stripe.PaymentIntent;

function createService() {
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'order_checkout',
        userId: 'user_checkout',
        userEmail: 'buyer@example.test',
        amount: 1700,
        currency: 'eur',
        paymentIntentId: 'pi_checkout',
        paidAt: null,
        user: { id: 'user_checkout' },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    subscription: { upsert: jest.fn().mockResolvedValue({}) },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  const notifications = { sendOrderConfirmation: jest.fn().mockResolvedValue(undefined) };
  const auth = {
    issueSanctuaireSessionForVerifiedPayment: jest.fn().mockResolvedValue({ token: 'session' }),
  };
  const service = new PaymentsService(
    { get: jest.fn().mockReturnValue('sk_live_test') } as never,
    {} as never,
    prisma as never,
    notifications as never,
    { generateOrderNumber: jest.fn() } as never,
    auth as never,
  );
  (service as unknown as { stripe: { paymentIntents: { retrieve: jest.Mock } } }).stripe = {
    paymentIntents: { retrieve: jest.fn().mockResolvedValue(paymentIntent) },
  };
  return { service, prisma, auth };
}

describe('PaymentsService.confirmCheckout', () => {
  it('rejects a succeeded PaymentIntent when the browser cannot prove its checkout attempt', async () => {
    const { service, prisma, auth } = createService();

    await expect(
      service.confirmCheckout('pi_checkout', 'pi_checkout_secret_other'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.order.updateMany).not.toHaveBeenCalled();
    expect(auth.issueSanctuaireSessionForVerifiedPayment).not.toHaveBeenCalled();
  });

  it('fulfills the fixed-term offer and issues a session only after proof validation', async () => {
    const { service, prisma, auth } = createService();

    await expect(service.confirmCheckout('pi_checkout', CLIENT_SECRET)).resolves.toEqual({
      token: 'session',
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'order_checkout' }),
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
    expect(auth.issueSanctuaireSessionForVerifiedPayment).toHaveBeenCalledWith(
      'buyer@example.test',
    );
  });
});
