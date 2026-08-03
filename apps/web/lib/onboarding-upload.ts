import sanctuaireApi from './sanctuaireApi';

type OnboardingPhotoKind = 'FACE' | 'PALM';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 1_200_000;
const MAX_SOURCE_PHOTO_BYTES = 30 * 1024 * 1024;

export async function uploadOriginalOnboardingPhoto(
  file: File,
  kind: OnboardingPhotoKind,
): Promise<string> {
  if (!file.size) throw new Error('Le fichier image est vide.');
  if (file.size > MAX_SOURCE_PHOTO_BYTES) {
    throw new Error('La photo source dépasse 30 Mo.');
  }

  const formData = new FormData();
  formData.append('file', file, file.name || `photo-${Date.now()}`);
  formData.append('kind', kind);

  const { data } = await sanctuaireApi.post<{
    storageRef?: string;
  }>('/uploads/onboarding-normalize', formData, {
    timeout: 60_000,
  });

  if (!data.storageRef?.startsWith('s3://onboarding/')) {
    throw new Error("Le stockage privé de la photo n'a pas été confirmé.");
  }

  return data.storageRef;
}

/**
 * Moves a browser-only preview into the private onboarding bucket. Only the
 * resulting s3:// reference is eligible for profile persistence.
 * Kept for already-normalized browser captures and backward compatibility.
 */
export async function uploadOnboardingPhoto(
  previewOrStorageRef: string | null | undefined,
  kind: OnboardingPhotoKind,
  orderId?: string,
): Promise<string | null> {
  if (!previewOrStorageRef) return null;
  if (previewOrStorageRef.startsWith('s3://onboarding/')) return previewOrStorageRef;
  if (!previewOrStorageRef.startsWith('data:image/')) {
    throw new Error('Format de photo non reconnu');
  }

  const blob = await fetch(previewOrStorageRef).then((response) => response.blob());
  if (!ALLOWED_TYPES.has(blob.type) || blob.size > MAX_PHOTO_BYTES) {
    throw new Error('La photo doit être une image JPEG, PNG ou WebP de 1,2 Mo maximum');
  }

  const { data } = await sanctuaireApi.post(
    '/uploads/onboarding-presign',
    {
      kind,
      contentType: blob.type,
      ...(orderId && { orderId }),
    },
    { timeout: 15_000 },
  );
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  let upload: Response;
  try {
    upload = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type },
      body: blob,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
  if (!upload.ok) {
    throw new Error('Le stockage privé de la photo a échoué');
  }

  return data.storageRef as string;
}
