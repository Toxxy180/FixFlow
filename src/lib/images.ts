export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_PORTFOLIO_IMAGES = 5;
export const MAX_STAGED_PORTFOLIO_IMAGES = MAX_PORTFOLIO_IMAGES * 2;
export const imageKinds = ['AVATAR', 'PORTFOLIO'] as const;
export type ImageKind = (typeof imageKinds)[number];
export const imageBucket = (kind: ImageKind) =>
  kind === 'AVATAR' ? 'fixflow-avatars' : 'fixflow-portfolios';
export function validImagePath(path: string, ownerId?: string) {
  return (
    /^[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/.test(path) &&
    (!ownerId || path.startsWith(`${ownerId}/`))
  );
}
export function avatarUrl(path?: string | null) {
  if (!path || !validImagePath(path) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fixflow-avatars/${path}`;
}
