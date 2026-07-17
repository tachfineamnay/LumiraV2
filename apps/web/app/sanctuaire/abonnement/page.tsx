import { redirect } from 'next/navigation';

/** Permanent access replaced subscription management in the client experience. */
export default function SubscriptionRedirectPage() {
  redirect('/sanctuaire/profile');
}
