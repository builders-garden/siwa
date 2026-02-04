import type { AgentSession } from './session-store.js';

export function renderDashboard(
  sessions: AgentSession[],
  nonceCount: number,
  mode: 'offline' | 'live'
): string {
  const sessionRows = sessions
    .map(
      (s) => `
      <tr>
        <td>${s.agentId}</td>
        <td title="${s.address}">${s.address.slice(0, 6)}...${s.address.slice(-4)}</td>
        <td title="${s.agentRegistry}">${s.agentRegistry.length > 30 ? s.agentRegistry.slice(0, 30) + '...' : s.agentRegistry}</td>
        <td><span class="badge badge-${s.verified === 'on-chain' ? 'live' : 'offline'}">${s.verified}</span></td>
        <td>${s.issuedAt.toISOString()}</td>
        <td>${s.expiresAt.toISOString()}</td>
        <td>
          <span class="token" title="${s.token}">${s.token.slice(0, 20)}...</span>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('${s.token}')">copy</button>
        </td>
      </tr>`
    )
    .join('');

  const uniqueAgents = new Set(sessions.map((s) => s.address)).size;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ERC-8004 SIWA Test Server</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0d1117; color: #c9d1d9; font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    font-size: 14px; padding: 24px;
  }
  h1 { color: #58a6ff; font-size: 20px; margin-bottom: 4px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; border-bottom: 1px solid #21262d; padding-bottom: 16px; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-offline { background: #1f6feb33; color: #58a6ff; border: 1px solid #1f6feb; }
  .badge-live { background: #23863633; color: #3fb950; border: 1px solid #238636; }
  .stats { display: flex; gap: 24px; margin-bottom: 24px; }
  .stat { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px 24px; flex: 1; }
  .stat-value { font-size: 28px; font-weight: 700; color: #f0f6fc; }
  .stat-label { font-size: 12px; color: #8b949e; margin-top: 4px; }
  h2 { font-size: 16px; color: #c9d1d9; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
  th { text-align: left; padding: 10px 12px; background: #21262d; color: #8b949e; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-top: 1px solid #21262d; font-size: 13px; }
  tr:hover td { background: #1c2128; }
  .token { color: #8b949e; font-size: 11px; }
  .copy-btn { background: #21262d; border: 1px solid #30363d; color: #8b949e; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-left: 6px; }
  .copy-btn:hover { background: #30363d; color: #c9d1d9; }
  .empty { text-align: center; padding: 32px; color: #484f58; }
  .test-panel { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin-top: 24px; }
  .test-panel h2 { margin-top: 0; }
  .input-group { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
  input[type="text"], textarea {
    background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 12px;
    border-radius: 6px; font-family: inherit; font-size: 13px; flex: 1;
  }
  textarea { resize: vertical; min-height: 80px; width: 100%; }
  button.action {
    background: #238636; border: 1px solid #2ea043; color: #fff; padding: 8px 16px;
    border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; white-space: nowrap;
  }
  button.action:hover { background: #2ea043; }
  label { color: #8b949e; font-size: 12px; display: block; margin-bottom: 4px; }
  .section { margin-top: 16px; }
</style>
</head>
<body>
  <div class="header">
    <h1>ERC-8004 SIWA Test Server</h1>
    <span class="badge badge-${mode === 'live' ? 'live' : 'offline'}">${mode}</span>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-value" id="nonce-count">${nonceCount}</div>
      <div class="stat-label">Nonces Issued</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="session-count">${sessions.length}</div>
      <div class="stat-label">Sessions Active</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="agent-count">${uniqueAgents}</div>
      <div class="stat-label">Agents Seen</div>
    </div>
  </div>

  <h2>Active Sessions</h2>
  <table>
    <thead>
      <tr>
        <th>Agent ID</th>
        <th>Address</th>
        <th>Registry</th>
        <th>Verified</th>
        <th>Issued At</th>
        <th>Expires At</th>
        <th>Token</th>
      </tr>
    </thead>
    <tbody id="sessions-body">
      ${sessionRows || '<tr><td colspan="7" class="empty">No active sessions</td></tr>'}
    </tbody>
  </table>

  <div class="test-panel">
    <h2>Test Panel</h2>

    <div class="section">
      <label>Request Nonce</label>
      <div class="input-group">
        <input type="text" id="nonce-address" placeholder="0x... agent address" />
        <button class="action" onclick="requestNonce()">Request Nonce</button>
      </div>
      <textarea id="nonce-response" readonly placeholder="Server response will appear here..."></textarea>
    </div>

    <div class="section">
      <label>Verify Signature</label>
      <div style="margin-bottom: 8px;">
        <textarea id="verify-message" placeholder="Full SIWA message..." rows="4"></textarea>
      </div>
      <div class="input-group">
        <input type="text" id="verify-signature" placeholder="0x... signature" />
        <button class="action" onclick="verifySignature()">Verify</button>
      </div>
      <textarea id="verify-response" readonly placeholder="Verification result will appear here..."></textarea>
    </div>
  </div>

<script>
async function requestNonce() {
  const address = document.getElementById('nonce-address').value;
  if (!address) return alert('Enter an address');
  try {
    const res = await fetch('/siwa/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, agentId: 1, agentRegistry: 'eip155:84532:0x8004AA63c570c570eBF15376c0dB199918BFe9Fb' })
    });
    const data = await res.json();
    document.getElementById('nonce-response').value = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById('nonce-response').value = 'Error: ' + e.message;
  }
}

async function verifySignature() {
  const message = document.getElementById('verify-message').value;
  const signature = document.getElementById('verify-signature').value;
  if (!message || !signature) return alert('Enter both message and signature');
  try {
    const res = await fetch('/siwa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature })
    });
    const data = await res.json();
    document.getElementById('verify-response').value = JSON.stringify(data, null, 2);
  } catch (e) {
    document.getElementById('verify-response').value = 'Error: ' + e.message;
  }
}

async function refreshSessions() {
  try {
    const res = await fetch('/siwa/sessions');
    const sessions = await res.json();
    const tbody = document.getElementById('sessions-body');
    if (!sessions.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No active sessions</td></tr>';
      document.getElementById('session-count').textContent = '0';
      document.getElementById('agent-count').textContent = '0';
      return;
    }
    document.getElementById('session-count').textContent = sessions.length;
    const agents = new Set(sessions.map(s => s.address));
    document.getElementById('agent-count').textContent = agents.size;
    tbody.innerHTML = sessions.map(s => {
      const addr = s.address;
      const truncAddr = addr.slice(0,6) + '...' + addr.slice(-4);
      const reg = s.agentRegistry.length > 30 ? s.agentRegistry.slice(0,30) + '...' : s.agentRegistry;
      const badgeClass = s.verified === 'on-chain' ? 'live' : 'offline';
      const tokenTrunc = s.token.slice(0,20) + '...';
      return '<tr>' +
        '<td>' + s.agentId + '</td>' +
        '<td title="' + addr + '">' + truncAddr + '</td>' +
        '<td title="' + s.agentRegistry + '">' + reg + '</td>' +
        '<td><span class="badge badge-' + badgeClass + '">' + s.verified + '</span></td>' +
        '<td>' + s.issuedAt + '</td>' +
        '<td>' + s.expiresAt + '</td>' +
        '<td><span class="token" title="' + s.token + '">' + tokenTrunc + '</span>' +
        '<button class="copy-btn" onclick="navigator.clipboard.writeText(\\'' + s.token + '\\')">copy</button></td>' +
        '</tr>';
    }).join('');
  } catch(e) { /* ignore polling errors */ }
}

setInterval(refreshSessions, 5000);
</script>
</body>
</html>`;
}
