'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavLink } from '@/lib/roles';

export interface NavProps {
  readonly links: readonly NavLink[];
}

export function Nav({ links }: NavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation">
      <ul className="flex flex-col gap-1" role="list">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 px-3 py-2 rounded-[var(--iai-radius-md)] text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--iai-primary)] text-white'
                    : 'text-[var(--iai-text-subtle)] hover:bg-[var(--iai-bg-subtle)] hover:text-[var(--iai-text)]',
                ].join(' ')}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
