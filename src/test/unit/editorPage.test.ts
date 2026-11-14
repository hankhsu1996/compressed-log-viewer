/**
 * The page an editor shows in place of a file's text
 *
 * File names come from the user's disk, so anything the page shows from one
 * must reach the webview as text, never as markup or script.
 */

import { expect } from 'chai';
import type * as vscode from 'vscode';
import { showPage } from '../../providers/editorPage';

function rendered(heading: string, message: string, label: string): string {
  const webview = { html: '' } as vscode.Webview;
  showPage(webview, { heading, message, actions: [{ id: '0', label }] });
  return webview.html;
}

describe('editor page', function () {
  it('shows a hostile file name as text', function () {
    const name = `"><img src=x onerror=alert(1)>'<script>alert(2)</script>&`;
    const html = rendered(name, `${name} is damaged.`, `Open ${name}`);

    expect(html).not.to.include('<img');
    expect(html).not.to.include('<script>alert');
    expect(html).to.include(
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;&#39;&lt;script&gt;alert(2)&lt;/script&gt;&amp;',
    );
  });

  it('runs only its own script', function () {
    const html = rendered('Heading', 'Message', 'Button');
    const nonce = /script-src 'nonce-([^']+)'/.exec(html)?.[1];

    expect(nonce).to.be.a('string');
    expect(html).to.include(`default-src 'none'`);
    expect(html.match(/<script/g)).to.have.length(1);
    expect(html).to.include(`<script nonce="${nonce}">`);
  });
});
