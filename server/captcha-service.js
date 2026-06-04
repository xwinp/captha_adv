import express from "express";
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

const captchaServicePort = 4175;
const appServiceUrl = "http://127.0.0.1:4174";
const themeMap = {
  blue: { name: "Blue", color: "#4f8cff" },
  green: { name: "Green", color: "#2ab673" },
  orange: { name: "Orange", color: "#f28b30" },
};

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

function startCaptchaService() {
  const app = express();
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(ensureClientId);

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
