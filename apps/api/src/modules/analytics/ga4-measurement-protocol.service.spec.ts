import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Ga4MeasurementProtocolService } from './ga4-measurement-protocol.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Ga4MeasurementProtocolService', () => {
  let service: Ga4MeasurementProtocolService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Ga4MeasurementProtocolService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GA4_ENABLED') return 'true';
              if (key === 'GA4_MEASUREMENT_ID') return 'G-TEST12345';
              if (key === 'GA4_API_SECRET') return 'secret_test_999';
              if (key === 'GA4_DEBUG') return 'false';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<Ga4MeasurementProtocolService>(Ga4MeasurementProtocolService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return false if GA4_ENABLED is false', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'GA4_ENABLED') return 'false';
      return null;
    });

    const result = await service.sendGa4Event({ client_id: '123', events: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBe('GA4_ENABLED is false');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('should post payload to GA4 Measurement Protocol endpoint and return success on 204', async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 204, data: {} });

    const result = await service.sendGa4Event({
      client_id: '12345.67890',
      events: [{ name: 'purchase', params: { transaction_id: 'pi_test' } }],
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(204);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://www.google-analytics.com/mp/collect?measurement_id=G-TEST12345&api_secret=secret_test_999',
      expect.objectContaining({ client_id: '12345.67890' }),
      expect.objectContaining({ timeout: 4000 }),
    );
  });

  it('should post to debug endpoint when GA4_DEBUG is true', async () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'GA4_ENABLED') return 'true';
      if (key === 'GA4_MEASUREMENT_ID') return 'G-TEST12345';
      if (key === 'GA4_API_SECRET') return 'secret_test_999';
      if (key === 'GA4_DEBUG') return 'true';
      return null;
    });

    mockedAxios.post.mockResolvedValueOnce({
      status: 200,
      data: { validationMessages: [] },
    });

    const result = await service.sendGa4Event({ client_id: '123', events: [] });
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('debug/mp/collect'),
      expect.anything(),
      expect.anything(),
    );
  });
});
