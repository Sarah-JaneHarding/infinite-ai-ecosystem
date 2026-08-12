import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { DistrictRollup } from '@/components/district/DistrictRollup';

export const metadata: Metadata = { title: 'District Rollup' };

export default async function DistrictPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  const allowed = ['platform_support', 'platform_admin'] as const;
  if (!allowed.includes(session.role as (typeof allowed)[number])) redirect('/');
  return <DistrictRollup />;
}
