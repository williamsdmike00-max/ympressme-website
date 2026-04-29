/**
 * Per-site configuration — edit this file (and ONLY this file) when
 * cloning this stack for a new client.
 *
 * Loaded as <script type="module"> by inquiry-submit.js.
 *
 * Onboarding a new client (e.g., AllStar Prints):
 *  1. In Supabase: create a new bucket `<clientname>-uploads` + add the
 *     anon-INSERT policy:
 *        create policy "anon uploads" on storage.objects for insert
 *        to anon with check (bucket_id = '<clientname>-uploads');
 *  2. In Web3Forms: create a new access key with the client's email
 *     as the recipient. Verify the recipient email when prompted.
 *  3. In this file: update SUPABASE_BUCKET and WEB3FORMS_ACCESS_KEY
 *     to the new values. Leave SUPABASE_URL/SUPABASE_ANON_KEY alone
 *     unless using a different Supabase project for this client.
 *  4. Push to the client's repo → their Vercel deploy picks it up.
 *
 * All four values below are PUBLIC by design — both Supabase anon keys
 * and Web3Forms access keys are intended to be embedded in client-side
 * code. Spam protection is the bucket's INSERT policy, Web3Forms rate
 * limiting, and the honeypot field on each form.
 */

export const SITE_CONFIG = {
  // Supabase project shared across Mike's agency clients
  supabaseUrl: 'https://dgsdftbkpxpfhttgwhze.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnc2RmdGJrcHhwZmh0dGd3aHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjMxODksImV4cCI6MjA5MjUzOTE4OX0.Xa4_CzSG1LUd4LJKhS4EoHqJ7uYFH9djwevPP87CCvI',

  // Per-client values — change these when cloning for a new site
  supabaseBucket: 'ympressme-uploads',
  web3formsAccessKey: 'fb862ae8-5d18-4daf-a634-e6dc5bc6bcf6',

  // Email subject prefix and from-name — branded per client
  brandName: 'YMPRESSME',
  fromName: 'YMPRESSME Website',
};
