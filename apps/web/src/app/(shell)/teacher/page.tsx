import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { TeacherStudio } from '@/components/teacher/TeacherStudio';
import { buildCurriculumMap, type CurriculumMapData } from '@/lib/atp-curriculum';
import { loadCurriculumMap } from '@/lib/atp-curriculum-loader';

export const metadata: Metadata = { title: 'Teacher Studio' };

type SearchParams = Record<string, string | string[] | undefined>;

/** A query-string value is untrusted: take a single string, or nothing. */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function TeacherPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'teacher') redirect('/');

  const params = await searchParams;
  const grade = single(params['grade']);
  const subject = single(params['subject']);

  // The tenant and actor come from the verified session only, never from the URL. Without
  // both there is nothing safe to read: show the empty state instead of querying.
  const curriculum: CurriculumMapData =
    session.tenantId !== '' && session.userId !== ''
      ? await loadCurriculumMap(
          { tenantId: session.tenantId, actorId: session.userId },
          grade,
          subject,
        )
      : buildCurriculumMap([], undefined, undefined);

  return <TeacherStudio curriculum={curriculum} />;
}
