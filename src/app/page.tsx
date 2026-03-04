/**
 * Health check / status page
 */

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '40px', maxWidth: '600px' }}>
      <h1>Demo Followup System</h1>
      <p>API-only service. No UI here.</p>
      <p><a href="/post-demo">Add post-demo prospect →</a></p>
      
      <h2>Endpoints</h2>
      <ul>
        <li><code>POST /api/webhooks/calendly</code> - Calendly booking events</li>
        <li><code>POST /api/webhooks/qstash</code> - Scheduled job execution</li>
        <li><code>POST /api/webhooks/reply/email</code> - Inbound email replies</li>
      </ul>

      <h2>Status</h2>
      <p>✓ Running</p>
    </main>
  );
}
