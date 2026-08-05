import { ReadingAmendmentFacade } from './reading-amendment.facade';

describe('ReadingAmendmentFacade legacy palm compatibility', () => {
  it('submits a stored private palm draft without exposing or resending its ref', async () => {
    const core = {
      getPhotoReference: jest.fn().mockResolvedValue({
        userId: 'user-1',
        storageRef: 's3://private/user-1/palm.jpg',
      }),
      submitPalm: jest.fn().mockResolvedValue({ id: 'ram-1', status: 'SUBMITTED' }),
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ kind: 'PALM_PHOTO' }]),
    };
    const facade = new ReadingAmendmentFacade(
      core as never,
      {} as never,
      {} as never,
      prisma as never,
      {} as never,
      { get: jest.fn() } as never,
    );

    await facade.submit('user-1', 'ram-1', {
      expectedRevision: 4,
      palmRole: 'PALM_LEFT',
    });

    expect(core.getPhotoReference).toHaveBeenCalledWith({
      amendmentId: 'ram-1',
      userId: 'user-1',
    });
    expect(core.submitPalm).toHaveBeenCalledWith('user-1', 'ram-1', {
      expectedRevision: 4,
      storageRef: 's3://private/user-1/palm.jpg',
      palmRole: 'PALM_LEFT',
    });
  });
});
