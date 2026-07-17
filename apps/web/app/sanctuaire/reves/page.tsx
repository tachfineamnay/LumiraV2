import { redirect } from 'next/navigation';

/** Legacy journal route retained for shared links and saved bookmarks. */
export default function DreamsRedirectPage() {
  redirect('/sanctuaire/synthesis');
}
