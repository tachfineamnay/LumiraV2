import { redirect } from 'next/navigation';

/** Legacy Chemin route retained for bookmarks. */
export default function PathRedirectPage() {
  redirect('/sanctuaire/synthesis');
}
