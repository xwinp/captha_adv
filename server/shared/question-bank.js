function svgDataUrl({ bg, shape, accent, label }) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="220" height="160" viewBox="0 0 220 160">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="220" height="160" rx="24" fill="url(#bg)" />
      <circle cx="170" cy="34" r="18" fill="${accent}" opacity="0.16" />
      ${shape}
      <rect x="16" y="16" width="88" height="28" rx="14" fill="#ffffff" opacity="0.92" />
      <text x="60" y="35" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="#14213d">${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const imageAssets = {
  aurora_orb: {
    value: "aurora_orb",
    label: { en: "Aurora Orb", zh: "极光球" },
    image: svgDataUrl({
      bg: "#dbeafe",
      accent: "#4f8cff",
      label: "AURORA",
      shape: `<circle cx="110" cy="86" r="42" fill="#4f8cff" opacity="0.24" />
              <circle cx="110" cy="86" r="26" fill="#4f8cff" opacity="0.84" />`,
    }),
  },
  solar_cube: {
    value: "solar_cube",
    label: { en: "Solar Cube", zh: "日曜方块" },
    image: svgDataUrl({
      bg: "#ffedd5",
      accent: "#f28b30",
      label: "SOLAR",
      shape: `<rect x="74" y="50" width="72" height="72" rx="18" fill="#f28b30" opacity="0.84" />`,
    }),
  },
  mint_triangle: {
    value: "mint_triangle",
    label: { en: "Mint Triangle", zh: "薄荷三角" },
    image: svgDataUrl({
      bg: "#dcfce7",
      accent: "#2ab673",
      label: "MINT",
      shape: `<polygon points="110,42 150,118 70,118" fill="#2ab673" opacity="0.86" />`,
    }),
  },
  rose_wave: {
    value: "rose_wave",
    label: { en: "Rose Wave", zh: "玫瑰波" },
    image: svgDataUrl({
      bg: "#ffe4e6",
      accent: "#e85d75",
      label: "ROSE",
      shape: `<path d="M52 98 C76 48, 144 48, 168 98 C144 122, 76 122, 52 98 Z" fill="#e85d75" opacity="0.82" />`,
    }),
  },
};

const QUESTION_BANK = {
  letter: [
    {
      id: "letter-single-01",
      selectionMode: "single",
      prompt: {
        en: "Please select the card containing B2",
        zh: "请选择包含 B2 的卡片",
      },
      answers: ["B2"],
      choices: ["A1", "B2", "C3", "D4", "E5", "F6", "G7", "H8", "J9"].map((value, index) => ({
        value,
        label: value,
        hint: {
          en: `Choice ${index + 1}`,
          zh: `候选 ${index + 1}`,
        },
        kind: "text",
      })),
    },
    {
      id: "letter-multi-01",
      selectionMode: "multiple",
      prompt: {
        en: "Please select all cards ending with 7",
        zh: "请选择所有以 7 结尾的卡片",
      },
      answers: ["G7", "N7", "T7"],
      choices: ["A1", "G7", "N7", "T7", "B2", "D4", "M5", "P8", "R9"].map((value, index) => ({
        value,
        label: value,
        hint: {
          en: `Choice ${index + 1}`,
          zh: `候选 ${index + 1}`,
        },
        kind: "text",
      })),
    },
  ],
  image: [
    {
      id: "image-single-01",
      selectionMode: "single",
      prompt: {
        en: "Please select the image named Aurora Orb",
        zh: "请选择名称为极光球的图片",
      },
      answers: ["aurora_orb"],
      choices: ["aurora_orb", "solar_cube", "mint_triangle", "rose_wave"].map((key, index) => ({
        value: imageAssets[key].value,
        label: imageAssets[key].label,
        image: imageAssets[key].image,
        hint: {
          en: `Image ${index + 1}`,
          zh: `图片 ${index + 1}`,
        },
        kind: "image",
      })),
    },
    {
      id: "image-multi-01",
      selectionMode: "multiple",
      prompt: {
        en: "Please select all cool-color images",
        zh: "请选择所有冷色调图片",
      },
      answers: ["aurora_orb", "mint_triangle"],
      choices: ["aurora_orb", "solar_cube", "mint_triangle", "rose_wave"].map((key, index) => ({
        value: imageAssets[key].value,
        label: imageAssets[key].label,
        image: imageAssets[key].image,
        hint: {
          en: `Image ${index + 1}`,
          zh: `图片 ${index + 1}`,
        },
        kind: "image",
      })),
    },
  ],
  custom: [
    {
      id: "custom-single-01",
      selectionMode: "single",
      prompt: {
        en: "Custom mode: select the card tagged Prototype 03",
        zh: "自定义模式：请选择标记为 Prototype 03 的卡片",
      },
      answers: ["prototype-03"],
      choices: [
        { value: "prototype-01", label: "Prototype 01", hint: { en: "Team Alpha", zh: "Alpha 小组" }, kind: "custom" },
        { value: "prototype-02", label: "Prototype 02", hint: { en: "Team Beta", zh: "Beta 小组" }, kind: "custom" },
        { value: "prototype-03", label: "Prototype 03", hint: { en: "Team Gamma", zh: "Gamma 小组" }, kind: "custom" },
        { value: "prototype-04", label: "Prototype 04", hint: { en: "Team Delta", zh: "Delta 小组" }, kind: "custom" },
      ],
    },
    {
      id: "custom-multi-01",
      selectionMode: "multiple",
      prompt: {
        en: "Custom mode: select all cards owned by Team Beta",
        zh: "自定义模式：请选择所有属于 Team Beta 的卡片",
      },
      answers: ["beta-02", "beta-05"],
      choices: [
        { value: "alpha-01", label: "Asset 01", hint: { en: "Team Alpha", zh: "Alpha 小组" }, kind: "custom" },
        { value: "beta-02", label: "Asset 02", hint: { en: "Team Beta", zh: "Beta 小组" }, kind: "custom" },
        { value: "gamma-03", label: "Asset 03", hint: { en: "Team Gamma", zh: "Gamma 小组" }, kind: "custom" },
        { value: "delta-04", label: "Asset 04", hint: { en: "Team Delta", zh: "Delta 小组" }, kind: "custom" },
        { value: "beta-05", label: "Asset 05", hint: { en: "Team Beta", zh: "Beta 小组" }, kind: "custom" },
      ],
    },
  ],
};

const modeList = ["letter", "image", "custom"];
const languageList = ["en", "zh"];
const maxGridItems = 9;

function normalizeMode(mode) {
  return modeList.includes(mode) ? mode : "letter";
}

function normalizeLanguage(language) {
  return languageList.includes(language) ? language : "zh";
}

function localizeChoice(choice, language) {
  return {
    value: choice.value,
    kind: choice.kind,
    label: typeof choice.label === "string" ? choice.label : choice.label[language],
    hint: typeof choice.hint === "string" ? choice.hint : choice.hint[language],
    image: choice.image ?? "",
  };
}

function validateQuestion(question) {
  if (!Array.isArray(question.choices) || question.choices.length === 0) {
    throw new Error(`Question ${question.id} must define choices.`);
  }

  if (question.choices.length > maxGridItems) {
    throw new Error(`Question ${question.id} exceeds the ${maxGridItems}-item grid limit.`);
  }

  if (!Array.isArray(question.answers) || question.answers.length === 0) {
    throw new Error(`Question ${question.id} must define at least one answer.`);
  }
}

function buildQuestion(mode, language, options = {}) {
  const normalizedMode = normalizeMode(mode);
  const normalizedLanguage = normalizeLanguage(language);
  const bank = QUESTION_BANK[normalizedMode];
  const excludeId = typeof options.excludeId === "string" ? options.excludeId : "";
  const candidates = bank.filter((item) => item.id !== excludeId);
  const source = candidates.length > 0 ? candidates : bank;
  const selected = source[Math.floor(Math.random() * source.length)];

  validateQuestion(selected);

  return {
    id: selected.id,
    mode: normalizedMode,
    language: normalizedLanguage,
    selectionMode: selected.selectionMode === "multiple" ? "multiple" : "single",
    instruction: selected.prompt[normalizedLanguage],
    answers: [...selected.answers],
    choices: selected.choices.map((choice) => localizeChoice(choice, normalizedLanguage)),
  };
}

export {
  QUESTION_BANK,
  buildQuestion,
  languageList,
  maxGridItems,
  modeList,
  normalizeLanguage,
  normalizeMode,
};
