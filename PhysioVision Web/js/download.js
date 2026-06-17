const DOWNLOAD_API = 'https://dl.physiovision.app';
const TURNSTILE_SITE_KEY = '0x4AAAAAADMHf-gX5yX2YfQp';

function detectWindows() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /Win/i.test(platform) || /Windows/i.test(ua);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

async function handleDownload(btn) {
  const statusEl = document.getElementById('download-status');

  const turnstileResponse = typeof turnstile !== 'undefined'
    ? turnstile.getResponse()
    : null;

  if (!turnstileResponse) {
    if (statusEl) {
      statusEl.textContent = 'Please complete the verification above first.';
      statusEl.style.color = 'var(--error, #D94040)';
    }
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
    Verifying...
  `;
  if (statusEl) { statusEl.textContent = ''; }

  try {
    const res = await fetch(DOWNLOAD_API + '/request-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cf_token: turnstileResponse }),
    });

    if (res.status === 429) {
      if (statusEl) {
        statusEl.textContent = 'Too many downloads. Please try again later.';
        statusEl.style.color = 'var(--error, #D94040)';
      }
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download for Windows
      `;
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Download request failed.');
    }

    const data = await res.json();

    const dlUrl = DOWNLOAD_API + '/download/' + encodeURIComponent(data.download_token);

    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
      Downloading... 0%
    `;

    if (statusEl && data.sha256) {
      statusEl.innerHTML =
        '<strong>SHA-256:</strong> <code style="font-size:11px;word-break:break-all;">' +
        data.sha256 + '</code>';
      statusEl.style.color = 'var(--ink-muted, #7A7A76)';
    }

    const dlRes = await fetch(dlUrl);
    if (!dlRes.ok) throw new Error('Download failed.');

    const contentLength = dlRes.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = dlRes.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) {
        const pct = Math.round((received / total) * 100);
        btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Downloading... ${pct}%
        `;
      }
    }

    const blob = new Blob(chunks, { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PhysioVision_v1_Setup.exe';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    btn.disabled = false;
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      Download complete
    `;
    if (typeof turnstile !== 'undefined') turnstile.reset();

    setTimeout(() => {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download for Windows
      `;
    }, 5000);

  } catch (e) {
    if (statusEl) {
      statusEl.textContent = e.message || 'Something went wrong. Please try again.';
      statusEl.style.color = 'var(--error, #D94040)';
    }
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download for Windows
    `;
  }
}

function renderDownloadContent() {
  const container = document.getElementById('download-content');
  if (!container) return;

  if (detectWindows()) {
    container.innerHTML = `
      <div class="download-card">
        <div class="download-card-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <h2>PhysioVision for Windows</h2>
        <p class="download-card-version">Windows 10 / 11 &middot; 64-bit</p>

        <div class="turnstile-wrap">
          <div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-theme="light"></div>
        </div>

        <button class="download-btn" id="download-btn" onclick="handleDownload(this)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download for Windows
        </button>

        <p id="download-status" class="download-size"></p>

        <div class="download-disclaimer">
          <div class="disclaimer-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="disclaimer-text">
            <strong>Windows SmartScreen notice:</strong> PhysioVision is built with Python and packaged as an executable. Windows Defender or SmartScreen may flag it as unrecognised — this is a <strong>false positive</strong> common with independent software that hasn't purchased a code-signing certificate. PhysioVision is fully open-source — you can review every line of code on <a href="https://github.com/wideindeed/Physiology-LLM-Capstone" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </div>
        </div>

        <div class="sys-reqs">
          <h3>System Requirements</h3>
          <ul>
            <li>Windows 10 or Windows 11</li>
            <li>64-bit operating system</li>
            <li>Webcam (built-in or external)</li>
            <li>4 GB RAM minimum</li>
            <li>Internet connection for AI coaching &amp; cloud sync</li>
          </ul>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="platform-notice">
        <div class="platform-notice-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <h2>Windows Only — For Now</h2>
        <p>PhysioVision is currently available for Windows 10 and 11 (64-bit). Support for macOS and Linux is coming soon.</p>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', renderDownloadContent);
