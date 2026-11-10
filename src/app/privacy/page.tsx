import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata: Metadata = { title: 'Privacy | Patchwork' };

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <Link className="text-button" href="/">← Back to Patchwork</Link>
      <h1>Privacy</h1>
      <p>Patchwork uses your Buffer account, organization and eligible draft text to let you review and apply exact corrections.</p>

      <h2>What Buffer access allows</h2>
      <p>Patchwork requests permission to read your account and read and edit drafts. It reads eligible drafts in the organization you choose and sends a text edit only after you approve that draft in a review. The sample uses fictional drafts stored by this instance.</p>

      <h2>What this instance stores</h2>
      <p>The server encrypts your Buffer access token and ends the connection within one hour. The database holds eligible draft copies, linked phrases, reviews and receipts. A live campaign expires seven days after its last saved change. A sample session lasts twelve hours. The server removes expired records when a workspace is opened.</p>

      <h2>Remove campaign data</h2>
      <p>Use Clear campaign to remove the copies, links and receipts in Patchwork. Disconnect ends your session and removes its stored token. You can revoke access in Buffer. If an earlier write is unresolved, the server retains the organization, post and operation identifiers needed to block another write.</p>
    </main>
  );
}
