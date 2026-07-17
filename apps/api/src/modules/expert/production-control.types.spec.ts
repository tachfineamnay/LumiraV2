import {
  isActiveProductionJob,
  readCurrentProduction,
  readExpertReview,
  toJson,
} from './production-control.types';

const queuedJob = {
  id: 'prod_test',
  orderId: 'order_test',
  orderNumber: 'LUM-TEST',
  type: 'READING_GENERATION' as const,
  status: 'QUEUED' as const,
  stage: 'QUEUED',
  attempts: 0,
  maxAttempts: 3,
  requestedByExpertId: 'expert_test',
  queuedAt: '2026-07-17T15:00:00.000Z',
};

describe('production control state helpers', () => {
  it('reads a persisted current job without changing legacy assignment fields', () => {
    const review = readExpertReview({
      assignedBy: 'expert_test',
      legacyNote: 'kept',
      production: queuedJob,
    });

    expect(review.assignedBy).toBe('expert_test');
    expect(review.legacyNote).toBe('kept');
    expect(readCurrentProduction(review)).toEqual(queuedJob);
  });

  it('does not treat malformed legacy JSON as a production job', () => {
    expect(readCurrentProduction(null)).toBeUndefined();
    expect(readCurrentProduction([])).toBeUndefined();
    expect(readCurrentProduction({ production: { status: 'RUNNING' } })).toBeUndefined();
  });

  it('recognizes only queued and running jobs as active', () => {
    expect(isActiveProductionJob(queuedJob)).toBe(true);
    expect(isActiveProductionJob({ ...queuedJob, status: 'RUNNING' })).toBe(true);
    expect(isActiveProductionJob({ ...queuedJob, status: 'SUCCEEDED' })).toBe(false);
    expect(isActiveProductionJob({ ...queuedJob, status: 'FAILED' })).toBe(false);
  });

  it('removes undefined values before writing a Prisma JSON field', () => {
    const normalized = toJson({
      production: {
        ...queuedJob,
        error: undefined,
        payload: { prompt: undefined, instruction: 'keep' },
      },
    });

    expect(normalized).toEqual({
      production: {
        ...queuedJob,
        payload: { instruction: 'keep' },
      },
    });
  });
});
