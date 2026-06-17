const DOWNLOAD_URL = 'https://api.physiovision.app/download/PhysioVision-Setup.exe';

function detectWindows() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /Win/i.test(platform) || /Windows/i.test(ua);
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
        <button class="download-btn" id="download-btn" disabled style="opacity: 0.6; cursor: not-allowed; background: var(--ink-muted);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          In Development
        </button>
        <p class="download-size" style="color: var(--accent); max-width: 300px; margin: 0 auto; line-height: 1.4;">
          Coming soon! The next update will reduce the file size to MBs and significantly improve startup speed.
        </p>
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
