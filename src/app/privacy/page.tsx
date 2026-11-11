import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata: Metadata = { title: 'Privacy | Patchwork' };

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <Link className="text-button" href="/">← Back to Patchwork</Link>
      <h1>Privacy policy</h1>
      <p>Updated <time dateTime="2026-11-11">11 November 2026</time></p>
      <p>Patchwork uses your Buffer account, organization and eligible draft text to let you review and apply exact corrections.</p>

      <h2>What Buffer access allows</h2>
      <p>Patchwork requests <code>account:read</code>, <code>posts:read</code> and <code>posts:write</code>. It reads eligible drafts in the selected organization and sends a text edit only after you approve that draft in a review. The public deployment restricts Buffer access to its configured account and organization. Anyone can use the fictional sample. <a href="https://buffer.com/legal#privacy-policy">Buffer privacy policy</a></p>

      <h2>What this instance stores</h2>
      <p>Patchwork uses a session cookie that browser scripts cannot read. The server encrypts the Buffer access token and ends the connection within one hour. The database holds eligible draft copies, linked phrases, reviews and receipts. A live campaign expires seven days after its last saved change. A sample session lasts twelve hours. The server cleans up expired records as workspaces are opened.</p>

      <h2>Hosting and logs</h2>
      <p>Vercel hosts the public deployment. Its logs may include request metadata such as the browser and request URL, including the one-use authorization code returned by Buffer. The hosted Buffer workbench stores records in Neon PostgreSQL. Deleted records can remain in database restore history until that history expires. Local installations store records in SQLite. <a href="https://vercel.com/legal/privacy-notice">Vercel privacy notice</a> · <a href="https://neon.com/security">Neon data storage</a></p>

      <h2>Remove campaign data</h2>
      <p>Use Clear campaign to remove the copies, links and receipts in Patchwork. Disconnect ends your session and removes its stored token. You can revoke access in Buffer. If an earlier write is unresolved, the server retains the organization, post and operation identifiers needed to block another write.</p>

      <h2>Questions</h2>
      <p>Use the <a href="https://github.com/JunaidAhamed-7777/patchwork/issues">public issue tracker</a> for questions that contain no private information. For questions about private data, follow the <a href="https://github.com/JunaidAhamed-7777/patchwork/blob/main/SECURITY.md">security reporting guidance</a>.</p>
    </main>
  );
}
