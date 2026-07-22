import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PdfFactory, ReadingPdfData } from './PdfFactory';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PdfFactory reading template', () => {
  const data: ReadingPdfData = {
    userName: 'Ariane Lumière',
    archetype: 'La Voyageuse intérieure',
    archetypeDescription: 'Une présence sensible, tournée vers les passages importants.',
    keywords: ['Ancrage', 'Élan'],
    introduction: 'Prenez le temps de vous poser.\n\nCette lecture vous appartient.',
    sections: [
      {
        domain: 'relations',
        title: 'Vos liens',
        content: 'Votre écoute est une ressource.\n\nElle mérite aussi des limites claires.',
      },
    ],
    karmicInsights: ['Observer ce qui revient sans vous juger.'],
    lifeMission: 'Choisir ce qui vous rend plus présente à votre vie.',
    rituals: [
      {
        name: 'Le rendez-vous avec soi',
        description: 'Quelques minutes de silence suffisent pour commencer.',
        instructions: ['Coupez les notifications.', 'Écrivez ce qui vous traverse.'],
      },
    ],
    conclusion: 'Gardez ce qui vous éclaire et laissez le reste se déposer.',
    birthData: { date: '12 février 1990', time: '08:15', place: 'Lyon' },
    generatedAt: '2026-07-20T10:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a navigable, actionable reading from validated content', async () => {
    const service = new PdfFactory({ get: jest.fn(() => 'http://gotenberg.test') } as never);
    await service.onModuleInit();

    const html = await service.compileTemplate('reading', data);

    expect(html).toContain('href="#chapter-0"');
    expect(html).toContain('Vos pratiques');
    expect(html).toContain("Point d'ancrage");
    expect(html).toContain('<p>Prenez le temps de vous poser.</p><p>Cette lecture vous appartient.</p>');
    expect(html).toContain('Ancrage');
  });

  it('escapes prose before turning paragraphs into PDF markup', async () => {
    const service = new PdfFactory({ get: jest.fn(() => 'http://gotenberg.test') } as never);
    await service.onModuleInit();

    const html = await service.compileTemplate('reading', {
      ...data,
      introduction: '<script>alert("xss")</script>',
    });

    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert("xss")</script>');
  });

  it('creates a fresh multipart stream for every Gotenberg attempt', () => {
    const service = new PdfFactory({
      get: jest.fn((key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService);
    const createForm = (service as unknown as {
      createConversionForm: (html: string, options: object) => unknown;
    }).createConversionForm.bind(service);

    const first = createForm('<html>lecture</html>', {});
    const second = createForm('<html>lecture</html>', {});

    expect(first).not.toBe(second);
  });

  it('accepts only a real PDF payload from Gotenberg', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: Buffer.from('%PDF-1.7\ncontent') });
    const service = new PdfFactory({
      get: jest.fn((key: string, fallback: unknown) => fallback),
    } as unknown as ConfigService);

    const pdf = await service.convertToPdf('<html>lecture</html>');

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:3002/forms/chromium/convert/html',
      expect.anything(),
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });

  it('rejects an HTML error page returned with a successful HTTP status', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: Buffer.from('<html>gateway error</html>') });
    const service = new PdfFactory({
      get: jest.fn((key: string, fallback: unknown) =>
        key === 'GOTENBERG_MAX_ATTEMPTS' ? 1 : fallback,
      ),
    } as unknown as ConfigService);

    await expect(service.convertToPdf('<html>lecture</html>')).rejects.toThrow(
      'not a valid PDF',
    );
  });
});
