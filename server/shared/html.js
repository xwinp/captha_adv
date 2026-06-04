function layout({ title, body, theme = "#4f8cff" }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      :root {
        --theme: ${theme};
        --text: #14213d;
        --muted: #64748b;
        --line: rgba(20, 33, 61, 0.1);
        --surface: rgba(255, 255, 255, 0.84);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(79, 140, 255, 0.18), transparent 26%),
          radial-gradient(circle at right center, rgba(42, 182, 115, 0.16), transparent 26%),
          linear-gradient(180deg, #f9fbff 0%, #eef3f8 100%);
      }
      a { color: inherit; }
      summary { list-style: none; }
      summary::-webkit-details-marker { display: none; }
      .shell { max-width: 1320px; margin: 0 auto; padding: 42px 20px 72px; }
      .card {
        background: var(--surface);
        backdrop-filter: blur(18px);
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 28px;
        box-shadow: 0 28px 60px rgba(42, 56, 92, 0.12);
        padding: 28px;
      }
      .eyebrow, .panel-kicker {
        margin: 0 0 12px;
        color: var(--theme);
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-size: 12px;
      }
      h1, h2, h3, p { margin-top: 0; }
      .muted { color: var(--muted); }
      .hero {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        align-items: center;
        margin-bottom: 18px;
      }
      .hero-copy { max-width: 760px; }
      .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 999px;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(255,255,255,0.8);
        box-shadow: 0 28px 60px rgba(42, 56, 92, 0.12);
      }
      .badge-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--theme);
        box-shadow: 0 0 0 6px color-mix(in srgb, var(--theme) 18%, transparent);
      }
      .mini-title {
        margin: 0;
        font-size: 0.98rem;
        color: var(--muted);
      }
      .site-nav, .widget-head, .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .site-nav { margin-bottom: 22px; }
      .site-brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-weight: 700;
      }
      .site-brand-mark {
        display: inline-grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        color: white;
        background: linear-gradient(135deg, var(--theme), color-mix(in srgb, var(--theme) 30%, #ffffff));
      }
      .site-nav-links, .cta-row, .config-pop-grid, .pill-wrap, .verify-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .chip, .button-primary, .button-secondary, .link, .config-summary, .submit-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 999px;
        text-decoration: none;
        border: 0;
        font: inherit;
      }
      .chip, .button-secondary, .link, .config-summary {
        background: white;
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.08);
      }
      .chip.is-active {
        background: color-mix(in srgb, var(--theme) 13%, #ffffff);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--theme) 42%, transparent);
        color: var(--theme);
      }
      .button-primary, .submit-button { color: white; background: var(--theme); }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(20, 33, 61, 0.06);
        color: var(--muted);
        font-size: 14px;
      }
      .product-hero {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 24px;
        align-items: center;
      }
      .hero-copy-block h1 {
        margin-bottom: 14px;
        font-size: clamp(2.2rem, 4vw, 3.6rem);
        line-height: 1.02;
      }
      .price-row {
        display: flex;
        align-items: end;
        gap: 12px;
        margin: 18px 0;
        flex-wrap: wrap;
      }
      .price-main { font-size: 2.3rem; font-weight: 800; line-height: 1; }
      .price-old { color: var(--muted); text-decoration: line-through; }
      .product-visual, .gallery-main, .gallery-thumb {
        position: relative;
        overflow: hidden;
        border-radius: 28px;
        background:
          radial-gradient(circle at 24% 24%, color-mix(in srgb, var(--theme) 26%, transparent), transparent 26%),
          linear-gradient(180deg, #ffffff 0%, #eef4ff 100%);
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.06);
      }
      .product-visual { min-height: 360px; }
      .product-device {
        position: absolute;
        inset: 52px 56px 52px 56px;
        border-radius: 34px;
        background: linear-gradient(145deg, #14213d, #31456d);
        box-shadow: 0 24px 50px rgba(20, 33, 61, 0.22);
      }
      .product-screen {
        position: absolute;
        inset: 18px;
        border-radius: 26px;
        background:
          linear-gradient(135deg, color-mix(in srgb, var(--theme) 35%, #ffffff), rgba(255,255,255,0.95)),
          linear-gradient(180deg, #ebf2ff, #ffffff);
      }
      .screen-orbit {
        position: absolute;
        width: 180px;
        height: 180px;
        top: 34px;
        right: 28px;
        border-radius: 50%;
        border: 1px solid rgba(20, 33, 61, 0.08);
      }
      .screen-badge, .thumb-chip {
        position: absolute;
        left: 22px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.9);
        box-shadow: 0 10px 24px rgba(20, 33, 61, 0.1);
      }
      .screen-badge { bottom: 22px; }
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      .feature-card, .spec-card, .buy-card {
        background: white;
        border-radius: 22px;
        padding: 20px;
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.08);
      }
      .product-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) 360px;
        gap: 22px;
      }
      .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .gallery-main { min-height: 360px; }
      .gallery-thumb { min-height: 172px; }
      .thumb-chip { top: 18px; }
      .art-ring, .art-core, .art-bar { position: absolute; }
      .art-ring {
        width: 210px; height: 210px; border-radius: 50%;
        border: 18px solid color-mix(in srgb, var(--theme) 22%, #ffffff);
        top: 54px; left: 50%; transform: translateX(-50%);
      }
      .art-core {
        width: 120px; height: 120px; border-radius: 28px;
        background: linear-gradient(145deg, #14213d, #32466f);
        top: 98px; left: 50%; transform: translateX(-50%);
      }
      .art-bar {
        left: 22px; right: 22px; bottom: 24px; height: 16px;
        border-radius: 999px; background: rgba(20, 33, 61, 0.08);
      }
      .spec-list { display: grid; gap: 12px; margin-top: 14px; }
      .spec-item {
        display: flex; justify-content: space-between; gap: 12px;
        padding-top: 12px; border-top: 1px solid rgba(20, 33, 61, 0.08);
      }
      .workspace { display: grid; grid-template-columns: 1fr; gap: 24px; }
      .captcha-shell {
        position: relative;
        min-height: 720px;
      }
      .config-toggle {
        position: absolute;
        top: 18px;
        left: 0;
        z-index: 3;
        width: 70px;
      }
      .config-toggle[open] { width: 320px; }
      .config-summary {
        width: 70px;
        min-height: 46px;
        padding: 12px 14px;
        justify-content: center;
        cursor: pointer;
        background: rgba(255,255,255,0.96);
        border-radius: 999px;
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.08);
      }
      .config-icon {
        width: 20px;
        height: 20px;
        display: inline-block;
        color: var(--theme);
      }
      .config-label { display: none; }
      .config-toggle[open] .config-summary {
        width: 100%;
        border-radius: 22px 22px 0 0;
        box-shadow: 0 24px 50px rgba(27, 39, 74, 0.14);
        justify-content: space-between;
      }
      .config-toggle[open] .config-label {
        display: inline;
        font-weight: 700;
        color: var(--text);
      }
      .config-panel {
        background: rgba(255,255,255,0.98);
        padding: 14px 18px 18px;
        display: grid;
        gap: 18px;
        border-radius: 0 0 22px 22px;
        box-shadow: 0 24px 50px rgba(27, 39, 74, 0.14);
      }
      .config-section + .config-section {
        border-top: 1px solid rgba(20, 33, 61, 0.08);
        padding-top: 18px;
      }
      .config-pop-grid { margin-top: 12px; }
      .preview-stage { display: grid; grid-template-columns: 1fr; }
      .demo-card {
        position: relative;
        overflow: hidden;
        padding: 28px;
        min-height: 640px;
        border-radius: 30px;
        background: linear-gradient(180deg, rgba(255,255,255,0.9), rgba(246,249,255,0.82));
        box-shadow: 0 28px 60px rgba(42, 56, 92, 0.12);
        margin-left: 0;
      }
      .config-toggle[open] ~ .demo-card {
        margin-left: 344px;
      }
      .demo-card-glow {
        position: absolute;
        inset: -20% auto auto -10%;
        width: 280px; height: 280px; border-radius: 50%;
        background: color-mix(in srgb, var(--theme) 22%, transparent);
        filter: blur(38px); opacity: 0.7;
      }
      .captcha-widget {
        position: relative;
        z-index: 1;
        width: min(100%, 560px);
        margin: 36px auto 0;
        background: #ffffff;
        border-radius: 22px;
        padding: 22px;
        box-shadow: 0 24px 50px rgba(27, 39, 74, 0.12);
      }
      .challenge-copy { margin-top: 18px; }
      .choice-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .choice-option {
        position: relative;
      }
      .choice-input {
        position: absolute;
        opacity: 0;
        inset: 0;
        pointer-events: none;
      }
      .choice-card {
        display: block;
        border-radius: 18px;
        background: rgba(20, 33, 61, 0.05);
        padding: 14px 12px;
        cursor: pointer;
        transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        color: var(--text);
        text-align: left;
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.04);
      }
      .choice-card:hover { transform: translateY(-1px); }
      .choice-input:checked + .choice-card {
        background: color-mix(in srgb, var(--theme) 12%, #ffffff);
        box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--theme) 42%, transparent);
      }
      .choice-main {
        display: block;
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .choice-sub {
        display: block;
        font-size: 13px;
        color: var(--muted);
      }
      .choice-image {
        display: block;
        width: 100%;
        height: 120px;
        object-fit: cover;
        border-radius: 14px;
        margin-bottom: 10px;
        box-shadow: inset 0 0 0 1px rgba(20, 33, 61, 0.08);
      }
      .alert {
        margin: 18px 0;
        padding: 14px 16px;
        border-radius: 16px;
      }
      .alert.error { background: rgba(232, 93, 117, 0.1); color: #a33b4f; }
      @media (max-width: 1100px) {
        .product-hero, .product-layout { grid-template-columns: 1fr; }
      }
      @media (max-width: 720px) {
        .hero, .site-nav { flex-direction: column; align-items: flex-start; }
        .feature-grid, .gallery, .choice-grid { grid-template-columns: 1fr; }
        .shell { padding: 24px 14px 40px; }
        .card, .demo-card, .captcha-widget { padding: 20px; }
        .captcha-widget { width: 100%; margin-top: 20px; }
        .config-toggle {
          position: static;
          width: 100%;
          margin-bottom: 16px;
        }
        .config-summary,
        .config-toggle[open] .config-summary,
        .config-toggle[open] {
          width: 100%;
        }
        .config-toggle[open] ~ .demo-card {
          margin-left: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">${body}</div>
  </body>
</html>`;
}

function appHomePage() {
  return layout({
    title: "Nebula X1 Home",
    body: `
      <div class="card">
        <div class="site-nav">
          <div class="site-brand">
            <span class="site-brand-mark">NX</span>
            <span>Nebula Devices</span>
          </div>
          <div class="site-nav-links">
            <a class="chip is-active" href="/">Home</a>
            <a class="chip" href="/goods">Goods</a>
          </div>
        </div>
        <div class="product-hero">
          <div class="hero-copy-block">
            <p class="eyebrow">Flagship Launch</p>
            <h1>Nebula X1 makes your desk feel like a studio.</h1>
            <p class="muted">A fictional premium smart display with spatial audio, matte 6K panel, and a compact dock built for creators, developers, and hybrid teams.</p>
            <div class="price-row">
              <span class="price-main">$1,299</span>
              <span class="price-old">$1,499</span>
              <span class="pill">Launch offer</span>
            </div>
            <div class="cta-row">
              <a class="button-primary" href="/goods">View product details</a>
              <a class="button-secondary" href="/data/goods">Open data route</a>
            </div>
          </div>
          <div class="product-visual">
            <div class="product-device">
              <div class="product-screen">
                <div class="screen-orbit"></div>
                <div class="screen-badge">6K Matte Display</div>
              </div>
            </div>
          </div>
        </div>
        <div class="feature-grid">
          <div class="feature-card">
            <p class="eyebrow">Audio</p>
            <h2>Spatial six-speaker array</h2>
            <p class="muted">Tuned for voice, music, and crisp conference playback without adding external speakers.</p>
          </div>
          <div class="feature-card">
            <p class="eyebrow">Studio Cam</p>
            <h2>4K adaptive framing</h2>
            <p class="muted">A centered wide-angle camera keeps you in frame during calls, demos, and livestreams.</p>
          </div>
          <div class="feature-card">
            <p class="eyebrow">Dock</p>
            <h2>One cable workspace</h2>
            <p class="muted">Thunderbolt passthrough, Ethernet, and fast charging tucked into a polished aluminum base.</p>
          </div>
        </div>
      </div>
    `,
  });
}

function goodsDetailPage({ currentPath }) {
  return layout({
    title: "Nebula X1 Goods",
    body: `
      <div class="card">
        <div class="site-nav">
          <div class="site-brand">
            <span class="site-brand-mark">NX</span>
            <span>Nebula Devices</span>
          </div>
          <div class="site-nav-links">
            <a class="chip" href="/">Home</a>
            <a class="chip is-active" href="/goods">Goods</a>
          </div>
        </div>
        <div class="product-layout">
          <div>
            <p class="eyebrow">Product Detail</p>
            <h1>Nebula X1 Creator Display</h1>
            <p class="muted">Current route: ${currentPath}. This page acts like a detailed product entry with imagery, pricing, specs, and purchase options.</p>
            <div class="gallery">
              <div class="gallery-main">
                <div class="art-ring"></div>
                <div class="art-core"></div>
                <div class="art-bar"></div>
              </div>
              <div>
                <div class="gallery-thumb"><span class="thumb-chip">Front view</span></div>
                <div class="gallery-thumb" style="margin-top:16px;"><span class="thumb-chip">Dock + ports</span></div>
              </div>
            </div>
            <div class="feature-grid">
              <div class="feature-card">
                <p class="eyebrow">Panel</p>
                <h2>32-inch 6K matte glass</h2>
                <p class="muted">Low glare finish for bright rooms and clean text rendering.</p>
              </div>
              <div class="feature-card">
                <p class="eyebrow">Color</p>
                <h2>99% DCI-P3</h2>
                <p class="muted">Factory calibrated for illustration, product work, and video review.</p>
              </div>
              <div class="feature-card">
                <p class="eyebrow">Ports</p>
                <h2>TB4, USB-C, HDMI, LAN</h2>
                <p class="muted">Enough connectivity to run your whole setup from one device.</p>
              </div>
            </div>
          </div>
          <div>
            <div class="buy-card">
              <p class="eyebrow">Purchase</p>
              <h2 style="margin-bottom:10px;">$1,299</h2>
              <p class="muted">Includes display, dock base, woven cable, and 2-year premium support.</p>
              <div class="spec-list">
                <div class="spec-item"><span>Shipping</span><strong>Free in 48h</strong></div>
                <div class="spec-item"><span>Warranty</span><strong>2 years</strong></div>
                <div class="spec-item"><span>Stock</span><strong>In stock</strong></div>
                <div class="spec-item"><span>Colors</span><strong>Graphite, Silver</strong></div>
              </div>
              <div class="cta-row">
                <a class="button-primary" href="/">Back to home</a>
                <a class="button-secondary" href="/data/goods">Open alias page</a>
              </div>
            </div>
            <div class="spec-card" style="margin-top:16px;">
              <p class="eyebrow">Highlights</p>
              <h2>Built for premium desks</h2>
              <p class="muted">A fictional product page with enough detail to feel like a real storefront destination after captcha verification.</p>
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

function renderChoice(choice, selectionMode, index) {
  const inputType = selectionMode === "multiple" ? "checkbox" : "radio";
  const image = choice.kind === "image"
    ? `<img class="choice-image" src="${choice.image}" alt="${choice.label}" />`
    : "";

  return `
    <label class="choice-option">
      <input class="choice-input" type="${inputType}" name="answer" value="${choice.value}" />
      <span class="choice-card">
        ${image}
        <span class="choice-main">${choice.label}</span>
        <span class="choice-sub">${choice.hint || `Choice ${index + 1}`}</span>
      </span>
    </label>
  `;
}

function renderConfigGroup({ title, currentValue, links }) {
  return `
    <div class="config-section">
      <div class="row">
        <span>${title}</span>
        <strong>${currentValue}</strong>
      </div>
      <div class="config-pop-grid">
        ${links.map((item) => `<a class="chip ${item.active ? "is-active" : ""}" href="${item.href}">${item.label}</a>`).join("")}
      </div>
    </div>
  `;
}

function captchaPage({
  returnTo,
  instruction,
  choices,
  failures,
  maxFailures,
  errorMessage,
  selectionMode,
  themeName,
  themeLinks,
  currentLanguage,
  languageName,
  languageLinks,
  currentMode,
  modeName,
  modeLinks,
  refreshHref,
  labels,
  themeColor,
}) {
  const alert = errorMessage ? `<div class="alert error">${errorMessage}</div>` : "";
  const selectionLabel =
    selectionMode === "multiple" ? labels.selectionMultiple : labels.selectionSingle;
  const selectionHint =
    selectionMode === "multiple" ? labels.choiceHelpMultiple : labels.choiceHelpSingle;

  return layout({
    title: "Captcha Service",
    theme: themeColor,
    body: `
      <div class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Captcha Service</p>
          <p class="mini-title">Verify to continue to ${returnTo}</p>
        </div>
        <div class="hero-badge">
          <span class="badge-dot"></span>
          <span>Adaptive Check</span>
        </div>
      </div>
      <div class="workspace">
        <section class="card">
          <div class="panel-heading">
            <p class="panel-kicker">Captcha Example</p>
            <h2>Live Preview</h2>
          </div>
          <div class="preview-stage">
            <div class="captcha-shell">
              <details class="config-toggle">
                <summary class="config-summary">
                  <svg class="config-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.34 2.94c.54-1.25 2.32-1.25 2.86 0l.54 1.25c.22.51.72.87 1.28.92l1.37.13c1.37.13 1.92 1.83.88 2.74l-1.04.91c-.42.37-.61.94-.48 1.49l.31 1.34c.31 1.35-1.13 2.4-2.31 1.69l-1.18-.71a1.64 1.64 0 0 0-1.69 0l-1.18.71c-1.18.71-2.62-.34-2.31-1.69l.31-1.34c.13-.55-.06-1.12-.48-1.49l-1.04-.91c-1.04-.91-.49-2.61.88-2.74l1.37-.13c.56-.05 1.06-.41 1.28-.92l.54-1.25Z" stroke="currentColor" stroke-width="1.6" />
                    <circle cx="12" cy="9.5" r="2.2" stroke="currentColor" stroke-width="1.6" />
                  </svg>
                  <span class="config-label">UI Setting</span>
                </summary>
                <div class="config-panel">
                  ${renderConfigGroup({ title: labels.theme, currentValue: themeName, links: themeLinks })}
                  ${renderConfigGroup({ title: labels.language, currentValue: languageName, links: languageLinks })}
                  ${renderConfigGroup({ title: labels.mode, currentValue: modeName, links: modeLinks })}
                </div>
              </details>
              <div class="demo-card">
                <div class="demo-card-glow"></div>
                <div class="captcha-widget">
                  <div class="widget-head">
                    <div>
                      <p class="panel-kicker">Captcha Challenge</p>
                      <strong>${modeName}</strong>
                    </div>
                    <a class="link" href="${refreshHref}">${labels.refresh}</a>
                  </div>
                  ${alert}
                  <div class="pill-wrap">
                    <span class="pill">${labels.returnUrl}: ${returnTo}</span>
                    <span class="pill">${labels.failures}: ${failures}/${maxFailures}</span>
                    <span class="pill">${selectionLabel}</span>
                  </div>
                  <div class="challenge-copy">
                    <p><strong>${instruction}</strong></p>
                    <p class="muted">${selectionHint}</p>
                  </div>
                  <div class="section">
                    <form method="post" action="/verify">
                      <input type="hidden" name="returnTo" value="${returnTo}" />
                      <input type="hidden" name="theme" value="${themeName.toLowerCase()}" />
                      <input type="hidden" name="language" value="${currentLanguage}" />
                      <input type="hidden" name="mode" value="${currentMode}" />
                      <div class="choice-grid">
                        ${choices.map((choice, index) => renderChoice(choice, selectionMode, index)).join("")}
                      </div>
                      <div class="verify-actions" style="margin-top:18px;">
                        <button class="submit-button" type="submit">${labels.submit}</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    `,
  });
}

function cooldownPage({ returnTo, remaining, retryHref }) {
  return layout({
    title: "Captcha Cooldown",
    theme: "#e85d75",
    body: `
      <div class="card">
        <p class="eyebrow">Captcha Service</p>
        <h1>Verification failed too many times</h1>
        <div class="alert error">You did not pass verification. Please wait ${remaining} before trying again.</div>
        <p class="muted">The original page was ${returnTo}. Once the cooldown ends, open that page again and a fresh challenge will appear.</p>
        <a class="link" href="${retryHref}">Try again after cooldown</a>
      </div>
    `,
  });
}

export { appHomePage, goodsDetailPage, captchaPage, cooldownPage };
