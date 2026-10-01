import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/components/auth/SignInForm', () => ({ SignInForm: () => null }));

import SignInPage from '../../src/app/sign-in/page.js';

async function render(error?: string | string[]): Promise<string> {
  const element = await SignInPage({
    searchParams: Promise.resolve(error === undefined ? {} : { error }),
  });
  return renderToStaticMarkup(element);
}

describe('/sign-in', () => {
  it('shows no error by default', async () => {
    expect(await render()).not.toContain('role="alert"');
  });

  it('tells a person with no role why they were turned away', async () => {
    const html = await render('AccessDenied');
    expect(html).toContain('role="alert"');
    expect(html).toContain('has no role');
  });

  it('shows a generic message for any other error code', async () => {
    expect(await render('Callback')).toContain('Sign-in did not complete');
  });

  it('never renders the error code from the URL', async () => {
    const html = await render('<script>alert(1)</script>');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('Sign-in did not complete');
  });

  it('ignores a repeated error parameter', async () => {
    expect(await render(['AccessDenied', 'x'])).not.toContain('role="alert"');
  });
});
