import { buildLumiraTtsPrompt } from './gemini-tts-prompt.builder';

describe('buildLumiraTtsPrompt', () => {
  it('builds prompt with default audio profile, continuity markers, and transcript', () => {
    const prompt = buildLumiraTtsPrompt({
      transcript: 'Ceci est un test de lecture.',
      chunkIndex: 1,
      totalChunks: 3,
    });

    expect(prompt).toContain('# AUDIO PROFILE');
    expect(prompt).toContain('You sound like a mature, emotionally intelligent human guide');
    expect(prompt).toContain('This transcript is segment 1 of 3 of the same');
    expect(prompt).toContain("# DIRECTOR'S NOTES");
    expect(prompt).toContain('# TRANSCRIPT');
    expect(prompt).toContain('[calmly, warmly]');
    expect(prompt).toContain('Ceci est un test de lecture.');
  });

  it('allows overriding the audio profile section if custom profile is supplied', () => {
    const prompt = buildLumiraTtsPrompt({
      transcript: 'Autre extrait de test.',
      chunkIndex: 2,
      totalChunks: 2,
      profile: '# CUSTOM PROFILE\nCustom voice instructions.',
    });

    expect(prompt).toContain('# CUSTOM PROFILE');
    expect(prompt).toContain('Custom voice instructions.');
    expect(prompt).toContain('This transcript is segment 2 of 2');
    expect(prompt).toContain('Autre extrait de test.');
  });
});
