import express from "express";
import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import {
  createClientId,
  formatRemaining,
  getLockState,
  getOrCreateChallenge,
  maxFailures,
  normalizeLanguage,
  normalizeMode,
  verifyChallenge,
} from "./shared/captcha-store.js";
import { languageList, modeList } from "./shared/question-bank.js";
import { captchaPage, cooldownPage } from "./shared/html.js";
import {
  getRandomChallenge,
  buildLocalChallenge,
  listQuestionFolders,
  verifyLocalAnswer,
} from "./shared/local-question-service.js";

const captchaServicePort = 4175;
const appServiceUrl = "http://127.0.0.1:4174";
const localImageStats = new Map();
const localStatsFileName = "local-stats.json";
const themeMap = {
  blue: { name: "Blue", color: "#4f8cff" },
  green: { name: "Green", color: "#2ab673" },
  orange: { name: "Orange", color: "#f28b30" },
};

function localImageStatsKey({ promptGroup, folderName, value }) {
  return `${promptGroup}/${folderName}/${value}`;
}

function getOrCreateLocalImageStat(imageResult) {
  const key = localImageStatsKey(imageResult);
  if (!localImageStats.has(key)) {
    localImageStats.set(key, {
      key,
      promptGroup: imageResult.promptGroup,
      folderName: imageResult.folderName,
      value: imageResult.value,
      imageUrl: imageResult.imageUrl,
      filePath: imageResult.filePath,
      shouldSelect: imageResult.shouldSelect,
      attempts: 0,
      correct: 0,
      wrong: 0,
      selected: 0,
    });
  }

  const stat = localImageStats.get(key);
  stat.imageUrl = imageResult.imageUrl;
  stat.filePath = imageResult.filePath;
  stat.shouldSelect = imageResult.shouldSelect;
  return stat;
}

function recordLocalImageStats(imageResults = []) {
  for (const imageResult of imageResults) {
    const stat = getOrCreateLocalImageStat(imageResult);
    stat.attempts += 1;
    stat.correct += imageResult.correct ? 1 : 0;
    stat.wrong += imageResult.correct ? 0 : 1;
    stat.selected += imageResult.selected ? 1 : 0;
  }
}

function serializeLocalImageStat(stat) {
  return {
    ...stat,
    accuracy: stat.attempts === 0 ? null : stat.correct / stat.attempts,
    selectionRate: stat.attempts === 0 ? null : stat.selected / stat.attempts,
  };
}

function localStatsFilePath(localQuestionsDir) {
  return path.join(path.dirname(localQuestionsDir), localStatsFileName);
}

function normalizePersistedStat(value) {
  if (!value || typeof value !== "object") return null;
  if (
    typeof value.promptGroup !== "string"
    || typeof value.folderName !== "string"
    || typeof value.value !== "string"
  ) {
    return null;
  }

  const stat = {
    key: typeof value.key === "string" ? value.key : localImageStatsKey(value),
    promptGroup: value.promptGroup,
    folderName: value.folderName,
    value: value.value,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : "",
    filePath: typeof value.filePath === "string" ? value.filePath : "",
    shouldSelect: value.shouldSelect === true,
    attempts: Number.isFinite(value.attempts) ? Math.max(0, Math.trunc(value.attempts)) : 0,
    correct: Number.isFinite(value.correct) ? Math.max(0, Math.trunc(value.correct)) : 0,
    wrong: Number.isFinite(value.wrong) ? Math.max(0, Math.trunc(value.wrong)) : 0,
    selected: Number.isFinite(value.selected) ? Math.max(0, Math.trunc(value.selected)) : 0,
  };

  stat.key = localImageStatsKey(stat);
  return stat;
}

function loadLocalImageStats(localQuestionsDir) {
  localImageStats.clear();

  try {
    const raw = fs.readFileSync(localStatsFilePath(localQuestionsDir), "utf-8");
    const data = JSON.parse(raw);
    const rows = Array.isArray(data?.images) ? data.images : Array.isArray(data) ? data : [];

    for (const row of rows) {
      const stat = normalizePersistedStat(row);
      if (stat) localImageStats.set(stat.key, stat);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Failed to load local image stats: ${error.message}`);
    }
  }
}

function saveLocalImageStats(localQuestionsDir) {
  const targetPath = localStatsFilePath(localQuestionsDir);
  const tempPath = `${targetPath}.tmp`;
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    images: [...localImageStats.values()]
      .map(serializeLocalImageStat)
      .sort((left, right) => (
        left.promptGroup.localeCompare(right.promptGroup)
        || left.folderName.localeCompare(right.folderName)
        || left.value.localeCompare(right.value)
      )),
  };

  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tempPath, targetPath);
}

function listLocalImageStats(localQuestionsDir) {
  const rows = [];

  for (const group of listQuestionFolders(localQuestionsDir)) {
    for (const question of group.questions) {
      const challenge = buildLocalChallenge(localQuestionsDir, group.prompt, question.folderName);
      if (!challenge) continue;

      const correctSet = new Set(challenge._correctAnswers);
      for (const choice of challenge.choices) {
        const seed = {
          promptGroup: challenge.promptGroup,
          folderName: challenge.folderName,
          value: choice.value,
          imageUrl: choice.imageUrl,
          filePath: choice.filePath,
          shouldSelect: correctSet.has(choice.value),
        };
        const key = localImageStatsKey(seed);
        rows.push(serializeLocalImageStat(localImageStats.get(key) ?? {
          key,
          ...seed,
          attempts: 0,
          correct: 0,
          wrong: 0,
          selected: 0,
        }));
      }
    }
  }

  return rows.sort((left, right) => (
    left.promptGroup.localeCompare(right.promptGroup)
    || left.folderName.localeCompare(right.folderName)
    || left.value.localeCompare(right.value)
  ));
}

function ensureClientId(request, response, next) {
  let clientId = request.cookies.captcha_client_id;

  if (!clientId) {
    clientId = createClientId();
    response.cookie("captcha_client_id", clientId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  request.clientId = clientId;
  next();
}

function normalizeReturnTo(value) {
  if (value === "/goods" || value === "/data/goods") {
    return value;
  }

  return "/";
}

function normalizeTheme(value) {
  if (typeof value === "string" && themeMap[value]) {
    return value;
  }

  return "blue";
}

function buildBaseQuery({ returnTo, theme, language, mode, error, refresh }) {
  const search = new URLSearchParams({
    returnTo,
    theme,
    language,
    mode,
  });

  if (error) {
    search.set("error", error);
  }

  if (refresh) {
    search.set("refresh", "1");
  }

  return `/challenge?${search.toString()}`;
}

function localizedLabels(language) {
  if (language === "zh") {
    return {
      mismatch: "验证失败，请重试。",
      expired: "当前题目已过期，系统已为你生成新题。",
      theme: "主题颜色",
      language: "语言",
      mode: "验证码形式",
      cooldown: "冷却 5 分钟",
      failures: "失败次数",
      refresh: "刷新题目",
      returnUrl: "目标地址",
      selectionSingle: "单选题",
      selectionMultiple: "多选题",
      submit: "提交验证",
      choiceHelpSingle: "请选择 1 个正确项",
      choiceHelpMultiple: "请选择所有正确项后再提交",
      modes: {
        letter: "选字母",
        image: "选图片",
        custom: "自定义",
      },
      languages: {
        zh: "中文",
        en: "English",
      },
    };
  }

  return {
    mismatch: "Verification failed. Please try again.",
    expired: "This challenge expired. A fresh one has been generated.",
    theme: "Theme Color",
    language: "Language",
    mode: "Challenge Type",
    cooldown: "5 minute cooldown",
    failures: "Failed attempts",
    refresh: "Refresh challenge",
    returnUrl: "Return URL",
    selectionSingle: "Single select",
    selectionMultiple: "Multi select",
    submit: "Submit verification",
    choiceHelpSingle: "Select 1 correct item",
    choiceHelpMultiple: "Select all correct items, then submit",
    modes: {
      letter: "Letters",
      image: "Images",
      custom: "Custom",
    },
    languages: {
      zh: "Chinese",
      en: "English",
    },
  };
}

function localChallengePage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>本地题目 - 验证码挑战</title>
  <style>
    :root {
      --theme: #4f8cff;
      --text: #14213d;
      --muted: #64748b;
      --bg: #f8fafd;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: radial-gradient(circle at top left, rgba(79,140,255,0.12), transparent 30%),
                  radial-gradient(circle at right center, rgba(42,182,115,0.10), transparent 30%),
                  linear-gradient(180deg, #f9fbff 0%, #eef3f8 100%);
      min-height: 100vh;
    }
    .shell { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header .eyebrow {
      color: var(--theme); font-weight: 700; font-size: 12px;
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px;
    }
    .header h1 { font-size: 1.6rem; margin-bottom: 6px; }
    .card {
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 24px;
      box-shadow: 0 24px 50px rgba(42,56,92,0.10);
      padding: 28px;
    }
    .prompt-section { margin-bottom: 24px; }
    .prompt-section img {
      max-width: 100%; border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .mode-badge {
      display: inline-block; padding: 5px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 700; margin-bottom: 14px;
      background: color-mix(in srgb, var(--theme) 12%, white);
      color: var(--theme);
    }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    @media (max-width: 520px) { .choice-grid { grid-template-columns: repeat(2, 1fr); } }
    .choice-card {
      position: relative;
      border-radius: 18px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease;
      border: 3px solid transparent;
      background: rgba(20,33,61,0.04);
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .choice-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.10); }
    .choice-card.selected {
      border-color: var(--theme);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme) 24%, transparent);
      background: color-mix(in srgb, var(--theme) 8%, white);
    }
    .choice-card img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
    .check-mark {
      position: absolute; top: 8px; right: 8px;
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--theme); color: white;
      display: none; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .choice-card.selected .check-mark { display: flex; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 12px 24px; border-radius: 999px; border: 0;
      font: inherit; font-weight: 600; cursor: pointer;
      transition: opacity 150ms ease, transform 150ms ease;
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; pointer-events: none; }
    .btn-primary { color: white; background: var(--theme); }
    .btn-secondary { background: white; box-shadow: inset 0 0 0 1px rgba(20,33,61,0.12); }
    .result {
      margin-top: 20px; padding: 16px; border-radius: 16px;
      font-weight: 600; text-align: center; display: none;
    }
    .result.success { display: block; background: rgba(42,182,115,0.10); color: #1a7d4e; }
    .result.fail { display: block; background: rgba(232,93,117,0.10); color: #a33b4f; }
    .result.loading { display: block; background: rgba(79,140,255,0.08); color: #2d5fcc; }
    .loading-spinner {
      display: none; text-align: center; padding: 40px; color: var(--muted);
    }
    .loading-spinner.active { display: block; }
    .meta { margin-top: 12px; font-size: 13px; color: var(--muted); text-align: center; }

    /* ── 选择器 ── */
    .selector-section { margin-bottom: 20px; }
    .selector-label {
      font-size: 13px; font-weight: 700; color: var(--muted);
      margin-bottom: 8px; display: block;
    }
    .chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .chip {
      padding: 8px 18px; border-radius: 999px; border: 0; font: inherit;
      font-size: 14px; font-weight: 600; cursor: pointer;
      background: white; color: var(--text);
      box-shadow: inset 0 0 0 1px rgba(20,33,61,0.10);
      transition: all 150ms ease;
    }
    .chip:hover { background: color-mix(in srgb, var(--theme) 6%, white); }
    .chip.active {
      background: color-mix(in srgb, var(--theme) 14%, white);
      box-shadow: inset 0 0 0 2px var(--theme);
      color: var(--theme);
    }
    .divider {
      margin: 16px 0; border: 0; border-top: 1px solid rgba(20,33,61,0.08);
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <p class="eyebrow">Local Question Challenge</p>
      <h1>图片验证码挑战</h1>
    </div>

    <div class="card" id="app">
      <div class="selector-section" id="selectorArea">
        <span class="selector-label">📁 选择分组</span>
        <div class="chip-row" id="promptChips"></div>
        <div id="questionSelector" style="display:none;">
          <span class="selector-label">📝 选择题号</span>
          <div class="chip-row" id="questionChips"></div>
        </div>
        <hr class="divider" id="selectorDivider" style="display:none;" />
      </div>

      <div class="loading-spinner" id="spinner"></div>

      <div id="challenge-area" style="display:none;">
        <div class="mode-badge" id="modeBadge"></div>

        <div class="prompt-section" id="promptArea"></div>

        <div class="choice-grid" id="choiceGrid"></div>

        <div class="actions">
          <button class="btn btn-primary" id="submitBtn" onclick="submitAnswer()">提交验证</button>
          <button class="btn btn-secondary" onclick="refreshChallenge()">换一题</button>
        </div>

        <div class="result" id="resultMsg"></div>
        <div class="meta" id="metaInfo"></div>
      </div>
    </div>
  </div>

  <script>
    let allGroups = [];
    let currentChallenge = null;
    let selectedValues = [];
    let selectedPrompt = null;

    /* ─── 初始化：加载分组列表 ─── */
    async function initSelectors() {
      try {
        const res = await fetch('/local-folders');
        const data = await res.json();
        allGroups = data.groups || [];
        renderPromptChips();
      } catch (e) {
        document.getElementById('promptChips').innerHTML = '<span style="color:#e85d75">加载分组失败</span>';
      }
    }

    function renderPromptChips() {
      const container = document.getElementById('promptChips');
      container.innerHTML = allGroups.map(function(g, i) {
        var cls = 'chip' + (selectedPrompt === g.prompt ? ' active' : '');
        return '<button class="' + cls + '" onclick="selectPrompt(\\'' + g.prompt + '\\')">' + g.prompt + '</button>';
      }).join('');
    }

    function selectPrompt(promptName) {
      selectedPrompt = promptName;
      renderPromptChips();

      // 找到对应分组
      var group = allGroups.find(function(g) { return g.prompt === promptName; });
      var qArea = document.getElementById('questionSelector');
      var qChips = document.getElementById('questionChips');
      var divider = document.getElementById('selectorDivider');

      if (group && group.questions.length > 0) {
        qArea.style.display = '';
        divider.style.display = '';
        qChips.innerHTML = group.questions.map(function(q) {
          return '<button class="chip" onclick="loadSpecificQuestion(\\'' + promptName + '\\', \\'' + q.folderName + '\\')">' +
            q.folderName + ' <span style="font-size:11px;color:var(--muted)">(' + q.selectionMode + ')</span></button>';
        }).join('');

        // 自动加载第一道题
        loadSpecificQuestion(promptName, group.questions[0].folderName);
      }
    }

    /* ─── 加载题目 ─── */
    async function loadRandomChallenge() {
      var result = document.getElementById('resultMsg');
      result.className = 'result';
      selectedValues = [];
      await fetchAndRender('/local-challenge');
    }

    async function loadSpecificQuestion(promptGroup, folderName) {
      var result = document.getElementById('resultMsg');
      result.className = 'result';
      selectedValues = [];
      // 高亮当前选中的题号
      var allQChips = document.querySelectorAll('#questionChips .chip');
      allQChips.forEach(function(c) { c.classList.remove('active'); });
      var target = document.querySelector('#questionChips .chip[onclick*="' + folderName + '"]');
      if (target) target.classList.add('active');
      await fetchAndRender('/local-challenge/' + encodeURIComponent(promptGroup) + '/' + encodeURIComponent(folderName));
    }

    async function fetchAndRender(url) {
      var spinner = document.getElementById('spinner');
      var area = document.getElementById('challenge-area');
      var result = document.getElementById('resultMsg');

      spinner.classList.add('active');
      area.style.display = 'none';
      result.className = 'result';
      selectedValues = [];

      try {
        var res = await fetch(url);
        if (!res.ok) throw new Error('Failed');
        currentChallenge = await res.json();
        renderChallenge(currentChallenge);
      } catch (e) {
        result.className = 'result fail';
        result.textContent = '加载题目失败';
        result.style.display = 'block';
      } finally {
        spinner.classList.remove('active');
        area.style.display = '';
      }
    }

    function renderChallenge(challenge) {
      document.getElementById('modeBadge').textContent =
        challenge.selectionMode === 'multiple' ? '多选题' : '单选题';

      document.getElementById('promptArea').innerHTML = challenge.promptImages
        .map(function(url) { return '<img src="' + url + '" alt="题目描述" />'; }).join('');

      document.getElementById('choiceGrid').innerHTML = challenge.choices.map(function(choice) {
        return '<div class="choice-card" data-value="' + choice.value + '" onclick="toggleChoice(this, \\'' + choice.value + '\\')">' +
          '<img src="' + choice.imageUrl + '" alt="' + choice.value + '" loading="lazy" />' +
          '<span class="check-mark">✓</span></div>';
      }).join('');

      document.getElementById('metaInfo').textContent =
        '分组: ' + challenge.promptGroup + ' / ' + challenge.folderName + ' | challengeId: ' + challenge.challengeId;
    }

    function toggleChoice(el, value) {
      if (!currentChallenge) return;
      if (currentChallenge.selectionMode === 'single') {
        document.querySelectorAll('.choice-card').forEach(function(c) { c.classList.remove('selected'); });
        el.classList.add('selected');
        selectedValues = [value];
      } else {
        el.classList.toggle('selected');
        if (selectedValues.includes(value)) {
          selectedValues = selectedValues.filter(function(v) { return v !== value; });
        } else {
          selectedValues.push(value);
        }
      }
    }

    async function submitAnswer() {
      if (!currentChallenge || selectedValues.length === 0) return;
      var btn = document.getElementById('submitBtn');
      var result = document.getElementById('resultMsg');
      btn.disabled = true;
      result.className = 'result loading';
      result.textContent = '正在验证...';

      try {
        var res = await fetch('/local-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptGroup: currentChallenge.promptGroup,
            folderName: currentChallenge.folderName,
            answers: selectedValues,
          }),
        });
        var data = await res.json();
        result.className = 'result ' + (data.success ? 'success' : 'fail');
        result.textContent = (data.success ? '✅ ' : '❌ ') + data.message;
      } catch (e) {
        result.className = 'result fail';
        result.textContent = '请求失败，请重试';
      } finally {
        btn.disabled = false;
      }
    }

    function refreshChallenge() {
      document.getElementById('resultMsg').className = 'result';
      selectedValues = [];
      if (currentChallenge) {
        loadSpecificQuestion(currentChallenge.promptGroup, currentChallenge.folderName);
      }
    }

    // 启动
    initSelectors();
  </script>
</body>
</html>`;
}

function demoPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Demo - 验证码演示</title>
  <style>
    :root {
      --theme: #4f8cff;
      --text: #14213d;
      --muted: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background: radial-gradient(circle at top left, rgba(79,140,255,0.12), transparent 30%),
                  radial-gradient(circle at right center, rgba(42,182,115,0.10), transparent 30%),
                  linear-gradient(180deg, #f9fbff 0%, #eef3f8 100%);
      min-height: 100vh;
    }
    .shell { max-width: 720px; margin: 0 auto; padding: 40px 20px 60px; }
    .header { text-align: center; margin-bottom: 32px; }
    .header .eyebrow {
      color: var(--theme); font-weight: 700; font-size: 12px;
      letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px;
    }
    .header h1 { font-size: 1.6rem; margin-bottom: 6px; }
    .card {
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(18px);
      border: 1px solid rgba(255,255,255,0.7);
      border-radius: 24px;
      box-shadow: 0 24px 50px rgba(42,56,92,0.10);
      padding: 28px;
    }
    .prompt-section { margin-bottom: 24px; }
    .prompt-section img {
      max-width: 100%; border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.06);
    }
    .mode-badge {
      display: inline-block; padding: 5px 12px; border-radius: 999px;
      font-size: 12px; font-weight: 700; margin-bottom: 14px;
      background: color-mix(in srgb, var(--theme) 12%, white);
      color: var(--theme);
    }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }
    @media (max-width: 520px) { .choice-grid { grid-template-columns: repeat(2, 1fr); } }
    .choice-card {
      position: relative;
      border-radius: 18px; overflow: hidden; cursor: pointer;
      transition: transform 150ms ease, box-shadow 150ms ease;
      border: 3px solid transparent;
      background: rgba(20,33,61,0.04);
      aspect-ratio: 1;
      display: flex; align-items: center; justify-content: center;
    }
    .choice-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.10); }
    .choice-card.selected {
      border-color: var(--theme);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--theme) 24%, transparent);
      background: color-mix(in srgb, var(--theme) 8%, white);
    }
    .choice-card img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }

    /* ── 答案标注 ── */
    .choice-card.reveal-correct {
      border-color: #2ab673 !important;
      box-shadow: 0 0 0 5px rgba(42,182,115,0.22) !important;
      background: rgba(42,182,115,0.08) !important;
    }
    .choice-card.reveal-wrong {
      border-color: #e85d75 !important;
      box-shadow: 0 0 0 5px rgba(232,93,117,0.18) !important;
      background: rgba(232,93,117,0.06) !important;
    }
    .tag-dot {
      position: absolute; top: 8px; right: 8px;
      width: 26px; height: 26px; border-radius: 50%;
      display: none; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
    }
    .reveal-correct .tag-dot { display: flex; background: #2ab673; }
    .reveal-wrong   .tag-dot { display: flex; background: #e85d75; }
    .check-mark {
      position: absolute; top: 8px; right: 8px;
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--theme); color: white;
      display: none; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .choice-card.selected .check-mark { display: flex; }
    .reveal-correct .check-mark,
    .reveal-wrong   .check-mark { display: none; }

    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 12px 24px; border-radius: 999px; border: 0;
      font: inherit; font-weight: 600; cursor: pointer;
      transition: opacity 150ms ease, transform 150ms ease;
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; pointer-events: none; }
    .btn-primary { color: white; background: var(--theme); }
    .btn-secondary { background: white; box-shadow: inset 0 0 0 1px rgba(20,33,61,0.12); }
    .btn-outline {
      background: transparent; color: var(--theme);
      box-shadow: inset 0 0 0 1px var(--theme);
    }
    .result {
      margin-top: 20px; padding: 16px; border-radius: 16px;
      font-weight: 600; text-align: center; display: none;
    }
    .result.success { display: block; background: rgba(42,182,115,0.10); color: #1a7d4e; }
    .result.fail { display: block; background: rgba(232,93,117,0.10); color: #a33b4f; }
    .result.loading { display: block; background: rgba(79,140,255,0.08); color: #2d5fcc; }
    .loading-spinner {
      display: none; text-align: center; padding: 40px; color: var(--muted);
    }
    .loading-spinner.active { display: block; }
    .meta { margin-top: 12px; font-size: 13px; color: var(--muted); text-align: center; }

    .selector-section { margin-bottom: 20px; }
    .selector-label {
      font-size: 13px; font-weight: 700; color: var(--muted);
      margin-bottom: 8px; display: block;
    }
    .chip-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .chip {
      padding: 8px 18px; border-radius: 999px; border: 0; font: inherit;
      font-size: 14px; font-weight: 600; cursor: pointer;
      background: white; color: var(--text);
      box-shadow: inset 0 0 0 1px rgba(20,33,61,0.10);
      transition: all 150ms ease;
    }
    .chip:hover { background: color-mix(in srgb, var(--theme) 6%, white); }
    .chip.active {
      background: color-mix(in srgb, var(--theme) 14%, white);
      box-shadow: inset 0 0 0 2px var(--theme);
      color: var(--theme);
    }
    .divider {
      margin: 16px 0; border: 0; border-top: 1px solid rgba(20,33,61,0.08);
    }

    .legend {
      display: flex; gap: 18px; justify-content: center; margin-top: 8px;
      font-size: 13px; font-weight: 600; flex-wrap: wrap;
    }
    .legend-item { display: flex; align-items: center; gap: 5px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    .legend-dot.green { background: #2ab673; }
    .legend-dot.red   { background: #e85d75; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="header">
      <p class="eyebrow">Captcha Demo</p>
      <h1>验证码演示</h1>
      <div class="legend">
        <span class="legend-item"><span class="legend-dot green"></span> 正确答案</span>
        <span class="legend-item"><span class="legend-dot red"></span> 错误选项</span>
      </div>
    </div>

    <div class="card" id="app">
      <div class="selector-section" id="selectorArea">
        <span class="selector-label">📁 选择分组</span>
        <div class="chip-row" id="promptChips"></div>
        <div id="questionSelector" style="display:none;">
          <span class="selector-label">📝 选择题号</span>
          <div class="chip-row" id="questionChips"></div>
        </div>
        <hr class="divider" id="selectorDivider" style="display:none;" />
      </div>

      <div class="loading-spinner" id="spinner"></div>

      <div id="challenge-area" style="display:none;">
        <div class="mode-badge" id="modeBadge"></div>
        <div class="prompt-section" id="promptArea"></div>
        <div class="choice-grid" id="choiceGrid"></div>

        <div class="actions">
          <button class="btn btn-primary" id="submitBtn" onclick="submitAnswer()">提交验证</button>
          <button class="btn btn-outline" id="revealBtn" onclick="revealAnswers()" style="display:none;">👁 显示答案</button>
          <button class="btn btn-secondary" onclick="refreshChallenge()">换一题</button>
        </div>

        <div class="result" id="resultMsg"></div>
        <div class="meta" id="metaInfo"></div>
      </div>
    </div>
  </div>

  <script>
    var allGroups = [];
    var currentChallenge = null;
    var correctAnswersSet = null;
    var selectedValues = [];
    var selectedPrompt = null;
    var revealed = false;

    /* ─── 初始化 ─── */
    async function initSelectors() {
      try {
        var res = await fetch('/local-folders');
        var data = await res.json();
        allGroups = data.groups || [];
        renderPromptChips();
      } catch (e) {
        document.getElementById('promptChips').innerHTML = '<span style="color:#e85d75">加载失败</span>';
      }
    }

    function renderPromptChips() {
      var container = document.getElementById('promptChips');
      container.innerHTML = allGroups.map(function(g) {
        var cls = 'chip' + (selectedPrompt === g.prompt ? ' active' : '');
        return '<button class="' + cls + '" onclick="selectPrompt(\\'' + g.prompt + '\\')">' + g.prompt + '</button>';
      }).join('');
    }

    function selectPrompt(promptName) {
      selectedPrompt = promptName;
      renderPromptChips();
      var group = allGroups.find(function(g) { return g.prompt === promptName; });
      var qArea = document.getElementById('questionSelector');
      var qChips = document.getElementById('questionChips');
      var divider = document.getElementById('selectorDivider');
      if (group && group.questions.length > 0) {
        qArea.style.display = '';
        divider.style.display = '';
        qChips.innerHTML = group.questions.map(function(q) {
          return '<button class="chip" onclick="loadSpecificQuestion(\\'' + promptName + '\\', \\'' + q.folderName + '\\')">' +
            q.folderName + ' <span style="font-size:11px;color:var(--muted)">(' + q.selectionMode + ')</span></button>';
        }).join('');
        loadSpecificQuestion(promptName, group.questions[0].folderName);
      }
    }

    /* ─── 加载题目（使用 debug 接口拿到正确答案） ─── */
    async function loadSpecificQuestion(promptGroup, folderName) {
      resetState();
      var allQChips = document.querySelectorAll('#questionChips .chip');
      allQChips.forEach(function(c) { c.classList.remove('active'); });
      var target = document.querySelector('#questionChips .chip[onclick*="' + folderName + '"]');
      if (target) target.classList.add('active');

      var spinner = document.getElementById('spinner');
      var area = document.getElementById('challenge-area');
      spinner.classList.add('active');
      area.style.display = 'none';

      try {
        var res = await fetch('/local-debug-challenge/' + encodeURIComponent(promptGroup) + '/' + encodeURIComponent(folderName));
        if (!res.ok) throw new Error('Failed');
        currentChallenge = await res.json();
        correctAnswersSet = new Set(currentChallenge.correctAnswers || []);
        renderChallenge(currentChallenge);
      } catch (e) {
        document.getElementById('resultMsg').className = 'result fail';
        document.getElementById('resultMsg').textContent = '加载题目失败';
        document.getElementById('resultMsg').style.display = 'block';
      } finally {
        spinner.classList.remove('active');
        area.style.display = '';
        document.getElementById('revealBtn').style.display = '';
      }
    }

    function renderChallenge(challenge) {
      document.getElementById('modeBadge').textContent =
        challenge.selectionMode === 'multiple' ? '多选题' : '单选题';
      document.getElementById('promptArea').innerHTML = challenge.promptImages
        .map(function(url) { return '<img src="' + url + '" alt="题干" />'; }).join('');
      document.getElementById('choiceGrid').innerHTML = challenge.choices.map(function(choice) {
        return '<div class="choice-card" data-value="' + choice.value + '" onclick="toggleChoice(this, \\'' + choice.value + '\\')">' +
          '<img src="' + choice.imageUrl + '" alt="' + choice.value + '" loading="lazy" />' +
          '<span class="check-mark">✓</span>' +
          '<span class="tag-dot">✓</span>' +
        '</div>';
      }).join('');
      document.getElementById('metaInfo').textContent =
        '分组: ' + challenge.promptGroup + ' / ' + challenge.folderName + ' | ' +
        (correctAnswersSet ? correctAnswersSet.size + ' 个正确答案' : '');
    }

    function toggleChoice(el, value) {
      if (!currentChallenge || revealed) return;
      if (currentChallenge.selectionMode === 'single') {
        document.querySelectorAll('.choice-card').forEach(function(c) { c.classList.remove('selected'); });
        el.classList.add('selected');
        selectedValues = [value];
      } else {
        el.classList.toggle('selected');
        var idx = selectedValues.indexOf(value);
        if (idx >= 0) selectedValues.splice(idx, 1);
        else selectedValues.push(value);
      }
    }

    /* ─── 提交验证 ─── */
    async function submitAnswer() {
      if (!currentChallenge || selectedValues.length === 0) return;
      var btn = document.getElementById('submitBtn');
      var result = document.getElementById('resultMsg');
      btn.disabled = true;
      result.className = 'result loading';
      result.textContent = '正在验证...';

      try {
        var res = await fetch('/local-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptGroup: currentChallenge.promptGroup,
            folderName: currentChallenge.folderName,
            answers: selectedValues,
          }),
        });
        var data = await res.json();
        result.className = 'result ' + (data.success ? 'success' : 'fail');
        result.textContent = (data.success ? '✅ ' : '❌ ') + data.message;
        // 无论成功失败都高亮正确答案
        applyReveal();
      } catch (e) {
        result.className = 'result fail';
        result.textContent = '请求失败';
      } finally {
        btn.disabled = false;
      }
    }

    /* ─── 显示答案（不提交直接看） ─── */
    function revealAnswers() {
      applyReveal();
    }

    function applyReveal() {
      if (!correctAnswersSet) return;
      revealed = true;
      document.getElementById('revealBtn').style.display = 'none';
      document.getElementById('submitBtn').disabled = true;
      var cards = document.querySelectorAll('.choice-card');
      cards.forEach(function(card) {
        var v = card.getAttribute('data-value');
        card.classList.remove('selected');
        if (correctAnswersSet.has(v)) {
          card.classList.add('reveal-correct');
          card.querySelector('.tag-dot').textContent = '✓';
        } else {
          card.classList.add('reveal-wrong');
          card.querySelector('.tag-dot').textContent = '✗';
        }
        card.onclick = null;
      });
    }

    function resetState() {
      revealed = false;
      selectedValues = [];
      correctAnswersSet = null;
      document.getElementById('resultMsg').className = 'result';
      document.getElementById('submitBtn').disabled = false;
      document.getElementById('revealBtn').style.display = 'none';
    }

    function refreshChallenge() {
      if (currentChallenge) {
        loadSpecificQuestion(currentChallenge.promptGroup, currentChallenge.folderName);
      }
    }

    initSelectors();
  </script>
</body>
</html>`;
}

function cleanLocalDemoPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Captcha Demo</title>
  <style>
    :root { --primary:#2563eb; --text:#172033; --muted:#667085; --line:#e5eaf1; --soft:#f7f9fc; --success:#159455; --error:#d92d20; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; color: var(--text);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: radial-gradient(circle at 15% 10%, rgba(37,99,235,.18), transparent 32%),
                  radial-gradient(circle at 85% 0%, rgba(21,148,85,.14), transparent 30%),
                  linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%);
    }
    button { font: inherit; }
    .page { min-height: 100vh; display: grid; place-items: center; padding: 32px; }
    .modal {
      width: min(1180px, 100%); display: grid; grid-template-columns: minmax(0,1fr) 300px; gap: 20px;
      padding: 20px; border-radius: 32px; background: rgba(255,255,255,.72);
      border: 1px solid rgba(255,255,255,.86); box-shadow: 0 28px 80px rgba(23,32,51,.18);
    }
    .main, .side { background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 24px; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(28px, 4vw, 42px); line-height: 1.1; }
    h2 { font-size: 22px; }
    h3 { font-size: 14px; }
    .hint { color: var(--muted); font-size: 14px; line-height: 1.6; margin-top: 10px; }
    .ghost, .primary, .chip { border: 0; cursor: pointer; transition: 160ms ease; }
    .ghost { padding: 10px 16px; border-radius: 999px; color: var(--primary); background: #e8f0ff; font-weight: 800; text-decoration: none; }
    .primary { min-width: 140px; padding: 13px 18px; border-radius: 14px; color: #fff; background: var(--primary); font-weight: 800; }
    button:disabled { cursor: not-allowed; opacity: .58; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .pill {
      display: inline-flex; align-items: center; min-height: 34px; padding: 7px 12px; border-radius: 999px;
      background: var(--soft); color: var(--muted); font-size: 13px; font-weight: 800;
    }
    .pill.success { color: var(--success); background: #e7f7ef; }
    .pill.error { color: var(--error); background: #fff0ee; }
    .prompt {
      display: grid; place-items: center; min-height: 170px; padding: 18px; border: 1px dashed #cdd6e3;
      border-radius: 20px; background: var(--soft);
    }
    .prompt img { max-width: 100%; max-height: 220px; object-fit: contain; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; margin-top: 18px; }
    .choice {
      position: relative;
      display: grid; gap: 10px; padding: 12px; border: 2px solid transparent; border-radius: 18px;
      background: var(--soft); text-align: center; color: var(--text); font-weight: 800;
      cursor: zoom-in; transition: 160ms ease;
    }
    .choice:hover { transform: translateY(-2px); border-color: #c7d7fe; }
    .choice.active { border-color: var(--primary); background: #e8f0ff; }
    .choice img { width: 100%; aspect-ratio: 1 / .72; object-fit: contain; border-radius: 12px; background: #fff; }
    .choice span { overflow: hidden; color: var(--muted); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .select-corner {
      position: absolute; right: 12px; bottom: 38px; z-index: 2;
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 54px; min-height: 30px; padding: 6px 10px; border-radius: 999px;
      border: 0; cursor: pointer;
      background: rgba(255,255,255,.92); box-shadow: 0 8px 24px rgba(23,32,51,.16);
      color: var(--primary); font-size: 12px; font-weight: 900;
    }
    .choice.active .select-corner { background: var(--primary); color: #fff; }
    .actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
    .inline-stats { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
    .inline-stat {
      display: inline-flex; align-items: center; gap: 6px; max-width: 190px; min-height: 34px;
      padding: 7px 10px; border-radius: 999px; background: var(--soft); color: var(--muted);
      font-size: 12px; font-weight: 800;
    }
    .inline-stat span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .inline-stat strong { color: var(--primary); font-variant-numeric: tabular-nums; }
    .block + .block { margin-top: 22px; padding-top: 22px; border-top: 1px solid var(--line); }
    .chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .chip { padding: 10px 14px; border-radius: 999px; color: var(--text); background: var(--soft); font-weight: 800; }
    .chip.active { color: var(--primary); background: #e8f0ff; box-shadow: inset 0 0 0 2px var(--primary); }
    .empty { color: var(--muted); font-weight: 800; }
    .preview {
      position: fixed; inset: 0; z-index: 20; display: none; place-items: center;
      padding: 28px; background: rgba(15,23,42,.62);
    }
    .preview.open { display: grid; }
    .preview-card {
      position: relative; width: min(880px, 100%); max-height: min(760px, 88vh);
      display: grid; gap: 12px; padding: 22px; border-radius: 24px; background: #fff;
      box-shadow: 0 30px 90px rgba(0,0,0,.34);
    }
    .preview-card img { max-width: 100%; max-height: 66vh; object-fit: contain; }
    .preview-card p { color: var(--muted); text-align: center; font-weight: 800; }
    .preview-close {
      position: absolute; right: 14px; top: 14px; border: 0; border-radius: 999px;
      padding: 8px 12px; background: var(--primary); color: #fff; cursor: pointer; font-weight: 800;
    }
    @media (max-width: 900px) { .modal { grid-template-columns: 1fr; } .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 560px) { .head, .actions { align-items: stretch; flex-direction: column; } .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="modal">
      <div class="main">
        <div class="head">
          <div>
            <p class="eyebrow">Captcha Demo</p>
            <h1>本地题目验证</h1>
          </div>
          <div class="actions">
            <a class="ghost" href="/stats">查看统计</a>
            <button class="ghost" id="randomBtn" type="button">随机题目</button>
          </div>
        </div>
        <div class="meta">
          <span class="pill" id="questionMeta">未加载题目</span>
          <span class="pill" id="modeMeta">-</span>
        </div>
        <div class="prompt" id="promptArea"><div class="empty">正在加载题目...</div></div>
        <div class="grid" id="choiceGrid"></div>
        <div class="actions">
          <button class="primary" id="submitBtn" type="button" disabled>提交验证</button>
          <span class="pill" id="statusText">请选择答案后提交</span>
          <div class="inline-stats" id="inlineStats" aria-label="当前题目每张图片正确率"></div>
        </div>
      </div>
      <aside class="side">
        <div class="block">
          <p class="eyebrow">Question Picker</p>
          <h2>选择题目</h2>
          <p class="hint">先选 prompt，再选 Q1/Q2。页面打开时会先加载随机题目。</p>
        </div>
        <div class="block">
          <h3>Prompt</h3>
          <div class="chips" id="promptChips"></div>
        </div>
        <div class="block">
          <h3>Question</h3>
          <div class="chips" id="questionChips"><span class="empty">请选择一个 prompt</span></div>
        </div>
      </aside>
    </section>
    <div class="preview" id="previewLayer" role="dialog" aria-modal="true">
      <div class="preview-card" id="previewCard">
        <button class="preview-close" id="previewClose" type="button">关闭</button>
        <img id="previewImage" alt="" />
        <p id="previewTitle"></p>
      </div>
    </div>
  </main>
  <script>
    var groups = [];
    var challenge = null;
    var selectedPrompt = "";
    var selectedAnswers = [];
    var busy = false;

    var promptChips = document.getElementById("promptChips");
    var questionChips = document.getElementById("questionChips");
    var promptArea = document.getElementById("promptArea");
    var choiceGrid = document.getElementById("choiceGrid");
    var questionMeta = document.getElementById("questionMeta");
    var modeMeta = document.getElementById("modeMeta");
    var statusText = document.getElementById("statusText");
    var submitBtn = document.getElementById("submitBtn");
    var randomBtn = document.getElementById("randomBtn");
    var inlineStats = document.getElementById("inlineStats");
    var previewLayer = document.getElementById("previewLayer");
    var previewCard = document.getElementById("previewCard");
    var previewClose = document.getElementById("previewClose");
    var previewImage = document.getElementById("previewImage");
    var previewTitle = document.getElementById("previewTitle");

    randomBtn.addEventListener("click", loadRandomQuestion);
    submitBtn.addEventListener("click", submitAnswer);
    previewLayer.addEventListener("click", closePreview);
    previewClose.addEventListener("click", closePreview);
    previewCard.addEventListener("click", function(event) { event.stopPropagation(); });

    init();

    async function init() {
      await Promise.all([loadGroups(), loadRandomQuestion()]);
    }

    async function loadGroups() {
      try {
        var res = await fetch("/local-folders");
        if (!res.ok) throw new Error("folders");
        var data = await res.json();
        groups = data.groups || [];
        renderPromptChips();
      } catch (error) {
        promptChips.innerHTML = '<span class="empty">分组加载失败，请重启 node server/index.js</span>';
      }
    }

    async function loadRandomQuestion() {
      await fetchChallenge("/local-challenge");
    }

    async function loadSpecificQuestion(promptName, folderName) {
      await fetchChallenge("/local-challenge/" + encodeURIComponent(promptName) + "/" + encodeURIComponent(folderName));
    }

    async function fetchChallenge(url) {
      setBusy(true);
      setStatus("正在加载题目...", "");
      promptArea.innerHTML = '<div class="empty">正在加载题目...</div>';
      choiceGrid.innerHTML = "";
      inlineStats.innerHTML = "";
      selectedAnswers = [];

      try {
        var res = await fetch(url);
        if (!res.ok) throw new Error("challenge");
        applyChallenge(await res.json());
      } catch (error) {
        challenge = null;
        questionMeta.textContent = "未加载题目";
        modeMeta.textContent = "-";
        promptArea.innerHTML = '<div class="empty">没有题目：请确认服务已重启，且 question.json 使用 picture 路径</div>';
        setStatus("题目加载失败", "error");
      } finally {
        setBusy(false);
      }
    }

    function applyChallenge(nextChallenge) {
      challenge = nextChallenge;
      selectedPrompt = nextChallenge.promptGroup;
      selectedAnswers = [];
      questionMeta.textContent = nextChallenge.promptGroup + " / " + nextChallenge.folderName;
      modeMeta.textContent = nextChallenge.selectionMode === "multiple" ? "多选" : "单选";
      setStatus("请选择答案后提交", "");
      inlineStats.innerHTML = "";
      renderPromptChips();
      renderQuestionChips();
      renderChallenge();
    }

    function renderPromptChips() {
      if (!groups.length) {
        promptChips.innerHTML = '<span class="empty">暂无分组</span>';
        return;
      }
      promptChips.innerHTML = groups.map(function(group) {
        return '<button class="chip ' + (group.prompt === selectedPrompt ? "active" : "") + '" data-prompt="' + escapeHtml(group.prompt) + '">' + escapeHtml(group.prompt) + '</button>';
      }).join("");
      promptChips.querySelectorAll("button").forEach(function(button) {
        button.addEventListener("click", function() {
          selectedPrompt = button.dataset.prompt;
          renderPromptChips();
          renderQuestionChips();
        });
      });
    }

    function renderQuestionChips() {
      var group = groups.find(function(item) { return item.prompt === selectedPrompt; });
      if (!group) {
        questionChips.innerHTML = '<span class="empty">请选择一个 prompt</span>';
        return;
      }
      questionChips.innerHTML = group.questions.map(function(question) {
        var active = challenge && challenge.promptGroup === selectedPrompt && challenge.folderName === question.folderName;
        return '<button class="chip ' + (active ? "active" : "") + '" data-folder="' + escapeHtml(question.folderName) + '">' + escapeHtml(question.folderName) + '</button>';
      }).join("");
      questionChips.querySelectorAll("button").forEach(function(button) {
        button.addEventListener("click", function() {
          loadSpecificQuestion(selectedPrompt, button.dataset.folder);
        });
      });
    }

    function renderChallenge() {
      promptArea.innerHTML = (challenge.promptImages || []).map(function(url) {
        return '<img src="' + escapeAttr(url) + '" alt="题干" />';
      }).join("");
      choiceGrid.innerHTML = (challenge.choices || []).map(function(choice) {
        return '<div class="choice" role="button" tabindex="0" data-value="' + escapeAttr(choice.value) + '">' +
          '<img src="' + escapeAttr(choice.imageUrl) + '" alt="' + escapeAttr(choice.value) + '" />' +
          '<span>' + escapeHtml(choice.value) + '</span>' +
          '<button class="select-corner" type="button">选择</button>' +
        '</div>';
      }).join("");
      choiceGrid.querySelectorAll(".choice").forEach(function(card) {
        card.addEventListener("click", function() { openPreview(card); });
        card.addEventListener("keydown", function(event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPreview(card);
          }
        });
        var selector = card.querySelector(".select-corner");
        selector.addEventListener("click", function(event) {
          event.stopPropagation();
          toggleAnswer(card, card.dataset.value);
        });
      });
      submitBtn.disabled = true;
    }

    function toggleAnswer(button, value) {
      if (!challenge || busy) return;
      setStatus("请选择答案后提交", "");
      if (selectedAnswers.includes(value)) {
        selectedAnswers = selectedAnswers.filter(function(item) { return item !== value; });
        button.classList.remove("active");
      } else {
        selectedAnswers.push(value);
        button.classList.add("active");
      }
      updateSelectLabels();
      submitBtn.disabled = selectedAnswers.length === 0;
    }

    function updateSelectLabels() {
      choiceGrid.querySelectorAll(".choice").forEach(function(button) {
        var label = button.querySelector(".select-corner");
        if (label) label.textContent = button.classList.contains("active") ? "已选" : "选择";
      });
    }

    function openPreview(button) {
      var image = button.querySelector("img");
      previewImage.src = image.src;
      previewImage.alt = button.dataset.value;
      previewTitle.textContent = button.dataset.value;
      previewLayer.classList.add("open");
    }

    function closePreview() {
      previewLayer.classList.remove("open");
      previewImage.removeAttribute("src");
    }

    async function submitAnswer() {
      if (!challenge || !selectedAnswers.length) return;
      setBusy(true);
      setStatus("正在验证...", "");
      try {
        var res = await fetch("/local-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptGroup: challenge.promptGroup, folderName: challenge.folderName, answers: selectedAnswers })
        });
        if (!res.ok) throw new Error("verify");
        var data = await res.json();
        setStatus(data.success ? "验证通过" : "验证失败，请重试", data.success ? "success" : "error");
        loadCurrentImageStats().catch(function() { inlineStats.innerHTML = ""; });
      } catch (error) {
        setStatus("请求失败", "error");
      } finally {
        setBusy(false);
      }
    }

    async function loadCurrentImageStats() {
      if (!challenge) return;
      var res = await fetch("/local-stats");
      if (!res.ok) throw new Error("stats");
      var data = await res.json();
      var rows = (data.images || []).filter(function(row) {
        return row.promptGroup === challenge.promptGroup && row.folderName === challenge.folderName;
      });
      inlineStats.innerHTML = rows.map(function(row) {
        return '<span class="inline-stat">' +
          '<span>' + escapeHtml(row.value) + '</span>' +
          '<strong>' + formatPercent(row.accuracy) + '</strong>' +
        '</span>';
      }).join("");
    }

    function setBusy(nextBusy) {
      busy = nextBusy;
      randomBtn.disabled = nextBusy;
      submitBtn.disabled = nextBusy || selectedAnswers.length === 0;
    }

    function setStatus(text, type) {
      statusText.textContent = text;
      statusText.className = "pill" + (type ? " " + type : "");
    }

    function formatPercent(value) {
      return typeof value === "number" ? (value * 100).toFixed(1) + "%" : "-";
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function(char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
  </script>
</body>
</html>`;
}

function localStatsPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>图片正确率统计</title>
  <style>
    :root { --primary:#2563eb; --text:#172033; --muted:#667085; --line:#e5eaf1; --soft:#f7f9fc; --success:#159455; --error:#d92d20; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; color: var(--text);
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background: linear-gradient(180deg, #f8fbff 0%, #eef3f8 100%);
    }
    .page { max-width: 1280px; margin: 0 auto; padding: 36px 24px 64px; }
    .head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 22px; }
    .eyebrow { margin: 0 0 8px; color: var(--primary); font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1, p { margin: 0; }
    h1 { font-size: clamp(28px, 4vw, 42px); }
    .hint { margin-top: 8px; color: var(--muted); line-height: 1.6; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button, a.button {
      border: 0; border-radius: 999px; padding: 10px 16px; background: var(--primary); color: #fff;
      cursor: pointer; font: inherit; font-weight: 800; text-decoration: none;
    }
    button.secondary, a.secondary { background: #fff; color: var(--primary); box-shadow: inset 0 0 0 1px #c7d7fe; }
    .cards { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; margin-bottom: 20px; }
    .metric { padding: 18px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
    .metric span { color: var(--muted); font-size: 13px; font-weight: 800; }
    .metric strong { display: block; margin-top: 6px; font-size: 26px; }
    .panel { overflow: auto; border: 1px solid var(--line); border-radius: 24px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: middle; }
    th { background: var(--soft); color: var(--muted); font-size: 13px; }
    tr:last-child td { border-bottom: 0; }
    img { width: 72px; height: 54px; object-fit: contain; border-radius: 10px; background: var(--soft); }
    .tag { display: inline-flex; padding: 5px 9px; border-radius: 999px; font-size: 12px; font-weight: 800; }
    .tag.ok { color: var(--success); background: #e7f7ef; }
    .tag.no { color: var(--error); background: #fff0ee; }
    .num { font-variant-numeric: tabular-nums; font-weight: 800; }
    @media (max-width: 760px) { .head { flex-direction: column; } .cards { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  </style>
</head>
<body>
  <main class="page">
    <div class="head">
      <div>
        <p class="eyebrow">Backend Stats</p>
        <h1>每张图片正确率统计</h1>
        <p class="hint">正确率口径：正确图片被选中算对，错误图片未被选中也算对；选中率单独展示。统计会保存到本地文件，重启后继续累计。</p>
      </div>
      <div class="actions">
        <button type="button" id="refreshBtn">刷新</button>
        <button class="secondary" type="button" id="resetBtn">清空统计</button>
        <a class="button secondary" href="/demo">返回 Demo</a>
      </div>
    </div>
    <section class="cards">
      <div class="metric"><span>图片数</span><strong id="imageCount">0</strong></div>
      <div class="metric"><span>总判定次数</span><strong id="attemptCount">0</strong></div>
      <div class="metric"><span>平均正确率</span><strong id="avgAccuracy">-</strong></div>
      <div class="metric"><span>平均选中率</span><strong id="avgSelection">-</strong></div>
    </section>
    <section class="panel">
      <table>
        <thead>
          <tr>
            <th>图片</th>
            <th>题目</th>
            <th>文件</th>
            <th>是否正确答案</th>
            <th>提交次数</th>
            <th>正确次数</th>
            <th>错误次数</th>
            <th>正确率</th>
            <th>选中次数</th>
            <th>选中率</th>
          </tr>
        </thead>
        <tbody id="statsBody"></tbody>
      </table>
    </section>
  </main>
  <script>
    var body = document.getElementById("statsBody");
    document.getElementById("refreshBtn").addEventListener("click", loadStats);
    document.getElementById("resetBtn").addEventListener("click", resetStats);
    loadStats();

    async function loadStats() {
      var res = await fetch("/local-stats");
      var data = await res.json();
      renderStats(data.images || []);
    }

    async function resetStats() {
      if (!confirm("确定清空当前长期统计？")) return;
      await fetch("/local-stats/reset", { method: "POST" });
      await loadStats();
    }

    function renderStats(rows) {
      var attempted = rows.filter(function(row) { return row.attempts > 0; });
      var attempts = rows.reduce(function(sum, row) { return sum + row.attempts; }, 0);
      var avgAccuracy = average(attempted.map(function(row) { return row.accuracy; }));
      var avgSelection = average(attempted.map(function(row) { return row.selectionRate; }));

      document.getElementById("imageCount").textContent = rows.length;
      document.getElementById("attemptCount").textContent = attempts;
      document.getElementById("avgAccuracy").textContent = formatPercent(avgAccuracy);
      document.getElementById("avgSelection").textContent = formatPercent(avgSelection);

      body.innerHTML = rows.map(function(row) {
        return '<tr>' +
          '<td><img src="' + escapeAttr(row.imageUrl) + '" alt="' + escapeAttr(row.value) + '" /></td>' +
          '<td>' + escapeHtml(row.promptGroup + " / " + row.folderName) + '</td>' +
          '<td>' + escapeHtml(row.value) + '</td>' +
          '<td><span class="tag ' + (row.shouldSelect ? "ok" : "no") + '">' + (row.shouldSelect ? "是" : "否") + '</span></td>' +
          '<td class="num">' + row.attempts + '</td>' +
          '<td class="num">' + row.correct + '</td>' +
          '<td class="num">' + row.wrong + '</td>' +
          '<td class="num">' + formatPercent(row.accuracy) + '</td>' +
          '<td class="num">' + row.selected + '</td>' +
          '<td class="num">' + formatPercent(row.selectionRate) + '</td>' +
        '</tr>';
      }).join("");
    }

    function average(values) {
      var usable = values.filter(function(value) { return typeof value === "number"; });
      if (!usable.length) return null;
      return usable.reduce(function(sum, value) { return sum + value; }, 0) / usable.length;
    }

    function formatPercent(value) {
      return typeof value === "number" ? (value * 100).toFixed(1) + "%" : "-";
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, function(char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function escapeAttr(value) {
      return escapeHtml(value);
    }
  </script>
</body>
</html>`;
}

function startCaptchaService({ localQuestionsDir } = {}) {
  if (localQuestionsDir) {
    loadLocalImageStats(localQuestionsDir);
  }

  const app = express();
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(ensureClientId);

  app.get("/demo", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).send("<h1>localQuestionsDir not configured</h1>");
    }
    return response.send(cleanLocalDemoPage());
  });

  app.get("/local-page", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).send("<h1>localQuestionsDir not configured</h1>");
    }
    return response.send(cleanLocalDemoPage());
  });

  app.get("/stats", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).send("<h1>localQuestionsDir not configured</h1>");
    }
    return response.send(localStatsPage());
  });

  app.get("/local-stats", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).json({ error: "localQuestionsDir not configured" });
    }
    const images = listLocalImageStats(localQuestionsDir);
    const attemptedImages = images.filter((image) => image.attempts > 0);
    const totalAttempts = images.reduce((sum, image) => sum + image.attempts, 0);
    const averageAccuracy = attemptedImages.length === 0
      ? null
      : attemptedImages.reduce((sum, image) => sum + image.accuracy, 0) / attemptedImages.length;
    const averageSelectionRate = attemptedImages.length === 0
      ? null
      : attemptedImages.reduce((sum, image) => sum + image.selectionRate, 0) / attemptedImages.length;

    return response.json({
      images,
      summary: {
        imageCount: images.length,
        attemptedImageCount: attemptedImages.length,
        totalAttempts,
        averageAccuracy,
        averageSelectionRate,
        statsFile: localStatsFilePath(localQuestionsDir),
      },
    });
  });

  app.post("/local-stats/reset", (request, response) => {
    localImageStats.clear();
    if (localQuestionsDir) saveLocalImageStats(localQuestionsDir);
    return response.json({ success: true });
  });

  app.get("/local-files/:promptGroup/:folderName/picture/:file", (request, response) => {
    if (!localQuestionsDir) return response.sendStatus(404);
    const { promptGroup, file } = request.params;
    const filePath = path.resolve(localQuestionsDir, promptGroup, "picture", file);
    const promptDir = path.resolve(localQuestionsDir, promptGroup);
    if (!filePath.startsWith(`${promptDir}${path.sep}`)) return response.sendStatus(403);
    response.sendFile(filePath, (err) => { if (err) response.sendStatus(404); });
  });

  // ── API：获取所有可用题目分组列表 ──
  app.get("/local-folders", (request, response) => {
    if (!localQuestionsDir) return response.json({ groups: [] });
    return response.json({ groups: listQuestionFolders(localQuestionsDir) });
  });

  // ── API：随机获取一个本地题目 ──
  app.get("/local-challenge", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).json({ error: "localQuestionsDir not configured" });
    }
    const challenge = getRandomChallenge(localQuestionsDir);
    if (!challenge) {
      return response.status(404).json({ error: "no available questions" });
    }
    const { _correctAnswers, ...publicData } = challenge;
    return response.json(publicData);
  });

  // ── 可视化页面：本地题目 ──
  app.get("/local-page", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).send("<h1>localQuestionsDir not configured</h1>");
    }
    return response.send(localChallengePage());
  });

  // ── 展示页面：全部题目一览（含正确答案标注） ──
  app.get("/demo", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).send("<h1>localQuestionsDir not configured</h1>");
    }
    return response.send(demoPage());
  });

  // ── API：获取指定题目 ──
  app.get("/local-challenge/:promptGroup/:folderName", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).json({ error: "localQuestionsDir not configured" });
    }
    const { promptGroup, folderName } = request.params;
    const challenge = buildLocalChallenge(localQuestionsDir, promptGroup, folderName);
    if (!challenge) {
      return response.status(404).json({ error: `"${promptGroup}/${folderName}" not found` });
    }
    const { _correctAnswers, ...publicData } = challenge;
    return response.json(publicData);
  });

  // ── DEBUG：返回含正确答案的完整题目（仅演示用） ──
  app.get("/local-debug-challenge/:promptGroup/:folderName", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).json({ error: "localQuestionsDir not configured" });
    }
    const { promptGroup, folderName } = request.params;
    const challenge = buildLocalChallenge(localQuestionsDir, promptGroup, folderName);
    if (!challenge) {
      return response.status(404).json({ error: `"${promptGroup}/${folderName}" not found` });
    }
    // 返回完整数据含正确答案
    return response.json({
      ...challenge,
      correctAnswers: challenge._correctAnswers,
    });
  });

  // ── API：验证本地题目答案 ──
  app.post("/local-verify", (request, response) => {
    if (!localQuestionsDir) {
      return response.status(400).json({ error: "localQuestionsDir not configured" });
    }
    const { promptGroup, folderName, answers } = request.body;
    if (!promptGroup || !folderName || !Array.isArray(answers)) {
      return response.status(400).json({ error: "promptGroup, folderName and answers are required" });
    }
    const result = verifyLocalAnswer(localQuestionsDir, promptGroup, folderName, answers);
    recordLocalImageStats(result.imageResults);
    saveLocalImageStats(localQuestionsDir);
    return response.json({
      success: result.success,
      message: result.success ? "验证通过" : "验证失败，请重试",
    });
  });

  app.get("/challenge", (request, response) => {
    const returnTo = normalizeReturnTo(request.query.returnTo);
    const theme = normalizeTheme(request.query.theme);
    const language = normalizeLanguage(request.query.language);
    const mode = normalizeMode(request.query.mode);
    const forceRefresh = request.query.refresh === "1";
    const labels = localizedLabels(language);
    const lockState = getLockState(request.clientId);

    if (lockState.locked) {
      return response.send(
        cooldownPage({
          returnTo,
          remaining: formatRemaining(lockState.remainingMs),
          retryHref: buildBaseQuery({ returnTo, theme, language, mode }),
        })
      );
    }

    const challenge = getOrCreateChallenge(request.clientId, returnTo, {
      mode,
      language,
      forceRefresh,
    });

    const errorMessage =
      request.query.error === "mismatch"
        ? labels.mismatch
        : request.query.error === "expired"
          ? labels.expired
          : "";

    return response.send(
      captchaPage({
        returnTo,
        instruction: challenge.instruction,
        choices: challenge.choices,
        failures: lockState.failures,
        maxFailures,
        errorMessage,
        selectionMode: challenge.selectionMode,
        themeName: themeMap[theme].name,
        currentLanguage: language,
        themeLinks: Object.entries(themeMap).map(([key, value]) => ({
          label: value.name,
          active: key === theme,
          href: buildBaseQuery({ returnTo, theme: key, language, mode, error: request.query.error }),
        })),
        languageName: labels.languages[language],
        currentMode: mode,
        languageLinks: languageList.map((key) => ({
          label: labels.languages[key],
          active: key === language,
          href: buildBaseQuery({ returnTo, theme, language: key, mode, error: request.query.error }),
        })),
        modeName: labels.modes[mode],
        modeLinks: modeList.map((key) => ({
          label: labels.modes[key],
          active: key === mode,
          href: buildBaseQuery({ returnTo, theme, language, mode: key, error: request.query.error }),
        })),
        refreshHref: buildBaseQuery({ returnTo, theme, language, mode, refresh: true }),
        labels,
        themeColor: themeMap[theme].color,
      })
    );
  });

  app.post("/verify", (request, response) => {
    const returnTo = normalizeReturnTo(request.body.returnTo);
    const theme = normalizeTheme(request.body.theme);
    const language = normalizeLanguage(request.body.language);
    const mode = normalizeMode(request.body.mode);
    const answers = request.body.answer;
    const result = verifyChallenge(request.clientId, returnTo, answers, { mode, language });

    if (result.ok) {
      return response.redirect(
        302,
        `${appServiceUrl}${returnTo}?captchaTicket=${encodeURIComponent(result.ticketId)}`
      );
    }

    if (result.reason === "locked") {
      return response.send(
        cooldownPage({
          returnTo,
          remaining: formatRemaining(result.remainingMs),
          retryHref: buildBaseQuery({ returnTo, theme, language, mode }),
        })
      );
    }

    return response.redirect(
      302,
      buildBaseQuery({ returnTo, theme, language, mode, error: result.reason })
    );
  });

  return app.listen(captchaServicePort, () => {
    console.log(`Captcha service listening on http://127.0.0.1:${captchaServicePort}`);
  });
}

export { startCaptchaService, captchaServicePort };
