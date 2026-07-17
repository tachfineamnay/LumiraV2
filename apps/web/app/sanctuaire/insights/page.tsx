import { redirect } from 'next/navigation';

/**
 * Legacy route: insights live under Synthèse.
 * Keep URL for bookmarks; always land on the canonical page.
 */
export default function InsightsRedirectPage() {
  redirect('/sanctuaire/synthesis');
}
