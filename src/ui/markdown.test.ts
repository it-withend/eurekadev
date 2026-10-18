import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Markdown } from './markdown';

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe('tutor markdown', () => {
  it('renders the formatting the tutor uses', () => {
    const out = html('**What you did**\n\n- You measured *L*\n- Then `T`\n\n1. first\n2. second\n\n## Why');
    expect(out).toContain('<strong>What you did</strong>');
    expect(out).toContain('<ul><li>You measured <em>L</em></li><li>Then <code>T</code></li></ul>');
    expect(out).toContain('<ol><li>first</li><li>second</li></ol>');
    expect(out).toContain('<p><strong>Why</strong></p>');
  });

  it('never turns a reply into HTML', () => {
    expect(html('<img src=x onerror=alert(1)> **hi**')).toBe('<p>&lt;img src=x onerror=alert(1)&gt; <strong>hi</strong></p>');
  });
});
