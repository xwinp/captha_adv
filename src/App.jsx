import { useEffect, useState } from "react";

const copyMap = {
  "zh-CN": {
    heroTitle: "参考极验 GT4 的 React 验证码 Demo",
    heroText: "左侧做配置，右侧接真实后端接口，验证码改成一个可运行的点击式校验流程。",
    panelSettings: "界面配置",
    panelPreview: "实时预览",
    generalSettings: "General Settings",
    captchaExample: "Captcha Example",
    language: "语言",
    languageHint: "切换右侧界面的显示文案",
    animation: "动效风格",
    animationHint: "调整验证码卡片出现方式",
    appearance: "展示风格",
    appearanceHint: "切换阴影和扁平化样式",
    theme: "主题色",
    themeHint: "用于按钮、焦点态和高亮块",
    radius: "圆角",
    radiusHint: "控制控件边缘曲率",
    mode: "模式",
    status: "当前状态",
    backend: "后端接口",
    backendValue: "Express /api/captcha/*",
    loginTitle: "安全验证演示",
    account: "账号",
    password: "密码",
    verify: "点击进行验证",
    login: "登录",
    ready: "待验证",
    loading: "加载中",
    verified: "验证成功",
    widgetTitle: "验证码校验",
    widgetMode: "后端挑战",
    open: "打开验证",
    refresh: "刷新验证码",
    start: "获取新验证码",
    instructionFallback: "点击下方按钮获取一个新的验证码挑战。",
    helperText: "这个版本会向后端请求题目，并在点击后把答案提交到接口校验。",
    challengeLoading: "正在请求验证码...",
    requestFailed: "验证码请求失败，请重试。",
    verifyFailed: "验证失败，请再试一次。",
    verifySuccess: "验证通过，已经允许登录。",
    close: "关闭",
    placeholderAccount: "name@example.com",
    placeholderPassword: "********",
  },
  en: {
    heroTitle: "React CAPTCHA Demo Inspired by GeeTest GT4",
    heroText: "The left side controls the UI while the right side talks to a real backend challenge API.",
    panelSettings: "UI Settings",
    panelPreview: "Live Preview",
    generalSettings: "General Settings",
    captchaExample: "Captcha Example",
    language: "Language",
    languageHint: "Switch interface copy on the right",
    animation: "Animation",
    animationHint: "Change how the challenge panel appears",
    appearance: "Appearance",
    appearanceHint: "Toggle between shadow and flat cards",
    theme: "Theme",
    themeHint: "Used for buttons and focus states",
    radius: "Radius",
    radiusHint: "Adjust control corner rounding",
    mode: "Mode",
    status: "Status",
    backend: "Backend",
    backendValue: "Express /api/captcha/*",
    loginTitle: "Security Demo",
    account: "Account",
    password: "Password",
    verify: "Click to verify",
    login: "Login",
    ready: "Waiting",
    loading: "Loading",
    verified: "Verified",
    widgetTitle: "Captcha Check",
    widgetMode: "Backend Challenge",
    open: "Open challenge",
    refresh: "Refresh",
    start: "Fetch challenge",
    instructionFallback: "Click the button below to request a new challenge.",
    helperText: "This version requests a challenge from the backend and verifies the selected answer through the API.",
    challengeLoading: "Requesting captcha...",
    requestFailed: "Failed to load captcha. Try again.",
    verifyFailed: "Verification failed. Please try again.",
    verifySuccess: "Verification passed. Login is now enabled.",
    close: "Close",
    placeholderAccount: "name@example.com",
    placeholderPassword: "********",
  },
};

const themeColors = ["#4f8cff", "#2ab673", "#f28b30", "#e85d75"];

function App() {
  const [language, setLanguage] = useState("zh-CN");
  const [animation, setAnimation] = useState("float");
  const [appearance, setAppearance] = useState("shadow");
  const [theme, setTheme] = useState(themeColors[0]);
  const [radius, setRadius] = useState(18);
  const [isWidgetOpen, setIsWidgetOpen] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const [challenge, setChallenge] = useState(null);

  const copy = copyMap[language];

  useEffect(() => {
    document.documentElement.style.setProperty("--theme", theme);
    document.documentElement.style.setProperty("--radius", `${radius}px`);
  }, [theme, radius]);

  useEffect(() => {
    fetchChallenge();
  }, [language]);

  async function fetchChallenge() {
    setIsLoading(true);
    setIsVerified(false);
    setServerMessage(copy.challengeLoading);
    try {
      const response = await fetch(`/api/captcha/new?lang=${encodeURIComponent(language)}`);
      if (!response.ok) {
        throw new Error("request_failed");
      }
      const data = await response.json();
      setChallenge(data);
      setServerMessage(data.instruction);
    } catch {
      setChallenge(null);
      setServerMessage(copy.requestFailed);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer(answer) {
    if (!challenge || isLoading || isVerified) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/captcha/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          answer,
          lang: language,
        }),
      });

      if (!response.ok) {
        throw new Error("verify_failed");
      }

      const data = await response.json();
      setIsVerified(data.success);
      setServerMessage(data.message);

      if (!data.success) {
        setChallenge(data.nextChallenge ?? null);
      }
    } catch {
      setIsVerified(false);
      setServerMessage(copy.verifyFailed);
    } finally {
      setIsLoading(false);
    }
  }

  const modeLabel =
    animation === "float" ? "Float" : animation === "popup" ? "Popup" : "Bind Button";
  const statusLabel = isLoading ? copy.loading : isVerified ? copy.verified : copy.ready;

  return (
    <div className="page-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Captcha Playground</p>
          <h1>{copy.heroTitle}</h1>
          <p className="hero-text">{copy.heroText}</p>
        </div>
        <div className="hero-badge">
          <span className="badge-dot"></span>
          <span>React + Express</span>
        </div>
      </header>

      <main className="workspace">
        <section className="panel">
          <div className="panel-heading">
            <p className="panel-kicker">{copy.generalSettings}</p>
            <h2>{copy.panelSettings}</h2>
          </div>

          <SettingBlock title={copy.language} hint={copy.languageHint}>
            <div className="chip-row">
              {["zh-CN", "en"].map((item) => (
                <button
                  key={item}
                  className={`chip ${language === item ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setLanguage(item)}
                >
                  {item === "zh-CN" ? "简体中文" : "English"}
                </button>
              ))}
            </div>
          </SettingBlock>

          <SettingBlock title={copy.animation} hint={copy.animationHint}>
            <div className="chip-row">
              {["float", "popup", "bind"].map((item) => (
                <button
                  key={item}
                  className={`chip ${animation === item ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setAnimation(item)}
                >
                  {item === "bind" ? "Bind Button" : item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </SettingBlock>

          <SettingBlock title={copy.appearance} hint={copy.appearanceHint}>
            <div className="chip-row">
              {["shadow", "flat"].map((item) => (
                <button
                  key={item}
                  className={`chip ${appearance === item ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setAppearance(item)}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </SettingBlock>

          <SettingBlock title={copy.theme} hint={copy.themeHint}>
            <div className="color-row">
              {themeColors.map((color) => (
                <button
                  key={color}
                  className={`color-dot ${theme === color ? "is-active" : ""}`}
                  style={{ "--swatch": color }}
                  type="button"
                  onClick={() => setTheme(color)}
                />
              ))}
            </div>
          </SettingBlock>

          <SettingBlock title={copy.radius} hint={copy.radiusHint}>
            <input
              value={radius}
              min="8"
              max="28"
              type="range"
              onChange={(event) => setRadius(Number(event.target.value))}
            />
          </SettingBlock>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <p className="panel-kicker">{copy.captchaExample}</p>
            <h2>{copy.panelPreview}</h2>
          </div>

          <div className="preview-stage">
            <aside className="info-card">
              <div className="brand-row">
                <span className="brand-mark">G4</span>
                <div>
                  <p className="brand-title">GeeTest Style Demo</p>
                  <p className="brand-subtitle">React verification preview</p>
                </div>
              </div>

              <ul className="stats">
                <li>
                  <span>{copy.mode}</span>
                  <strong>{modeLabel}</strong>
                </li>
                <li>
                  <span>{copy.status}</span>
                  <strong>{statusLabel}</strong>
                </li>
                <li>
                  <span>{copy.backend}</span>
                  <strong>{copy.backendValue}</strong>
                </li>
              </ul>
            </aside>

            <div className={`demo-card ${appearance}`}>
              <div className="demo-card-glow"></div>

              <div className="login-card">
                <div className="login-header">
                  <div>
                    <p className="login-overline">Secure access</p>
                    <h3>{copy.loginTitle}</h3>
                  </div>
                  <span className="status-pill">{statusLabel}</span>
                </div>

                <label className="input-shell">
                  <span>{copy.account}</span>
                  <input type="text" placeholder={copy.placeholderAccount} />
                </label>

                <label className="input-shell">
                  <span>{copy.password}</span>
                  <input type="password" placeholder={copy.placeholderPassword} />
                </label>

                <button
                  className="verify-trigger"
                  type="button"
                  onClick={() => setIsWidgetOpen((value) => !value)}
                >
                  <span>{copy.verify}</span>
                  <span className="trigger-arrow">-&gt;</span>
                </button>

                <button className="submit-button" type="button" disabled={!isVerified}>
                  {copy.login}
                </button>
              </div>

              {isWidgetOpen && (
                <div className={`captcha-widget ${animation === "bind" ? "bind-mode" : ""}`}>
                  <div className="widget-head">
                    <div>
                      <p className="widget-kicker">{copy.widgetTitle}</p>
                      <strong>{copy.widgetMode}</strong>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => setIsWidgetOpen(false)}>
                      {copy.close}
                    </button>
                  </div>

                  <div className="challenge-stage">
                    <div className="challenge-surface">
                      <div className="surface-pattern"></div>
                      <div className="surface-badge">API</div>
                    </div>

                    <div className="challenge-copy">
                      <p>{challenge?.instruction ?? copy.instructionFallback}</p>
                      <p className="challenge-tip">{serverMessage || copy.helperText}</p>
                    </div>

                    <div className="captcha-grid">
                      {(challenge?.choices ?? []).map((choice) => (
                        <button
                          key={choice.id}
                          className="captcha-choice"
                          type="button"
                          disabled={isLoading || isVerified}
                          onClick={() => submitAnswer(choice.value)}
                        >
                          <span className="captcha-choice-main">{choice.label}</span>
                          <span className="captcha-choice-sub">{choice.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="widget-actions">
                    <button className="secondary-button" type="button" disabled={isLoading} onClick={fetchChallenge}>
                      {copy.refresh}
                    </button>
                    <button className="primary-button" type="button" disabled={isLoading} onClick={fetchChallenge}>
                      {copy.start}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SettingBlock({ title, hint, children }) {
  return (
    <div className="setting-group">
      <div className="setting-label">
        <h3>{title}</h3>
        <p>{hint}</p>
      </div>
      {children}
    </div>
  );
}

export default App;
