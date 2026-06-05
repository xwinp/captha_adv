import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"]);
const QUESTION_FILE = "question.json";
const PICTURE_DIR = "picture";

function isDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function isImagePath(filePath) {
  return typeof filePath === "string" && IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function normalizeLocalPath(value) {
  if (!isImagePath(value)) return null;

  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    return null;
  }

  return normalized;
}

function readQuestionConfig(folderPath) {
  try {
    const raw = fs.readFileSync(path.join(folderPath, QUESTION_FILE), "utf-8");
    const config = JSON.parse(raw);

    if (!config || typeof config !== "object") return null;
    if (!Array.isArray(config.prompt) || !Array.isArray(config.question)) return null;
    if (!config.answers || typeof config.answers !== "object") return null;

    const prompt = config.prompt.map(normalizeLocalPath).filter(Boolean);
    const question = config.question.map(normalizeLocalPath).filter(Boolean);

    if (prompt.length === 0 || question.length === 0) return null;

    return {
      prompt,
      question,
      answers: config.answers,
    };
  } catch {
    return null;
  }
}

function fileExistsInside(questionDir, relativePath) {
  const absolutePath = path.resolve(questionDir, relativePath);
  const questionRoot = path.resolve(questionDir);

  if (!absolutePath.startsWith(`${questionRoot}${path.sep}`)) return false;

  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function isValidQuestionFolder(folderPath) {
  const config = readQuestionConfig(folderPath);
  if (!config) return false;

  const files = [...config.prompt, ...config.question];
  return files.every((filePath) => filePath.startsWith(`${PICTURE_DIR}/`) && fileExistsInside(folderPath, filePath));
}

function scanAll(rootDir) {
  if (!isDirectory(rootDir)) return [];

  const groups = [];
  const promptDirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const promptEntry of promptDirs) {
    const promptPath = path.join(rootDir, promptEntry.name);
    const questionDirs = fs.readdirSync(promptPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isValidQuestionFolder(path.join(promptPath, entry.name)))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    if (questionDirs.length > 0) {
      groups.push({ prompt: promptEntry.name, questions: questionDirs });
    }
  }

  return groups;
}

function answerIsCorrect(answerMap, relativePath) {
  const fileName = path.posix.basename(relativePath);
  return answerMap[relativePath] === true || answerMap[fileName] === true;
}

function imageUrl(promptGroup, folderName, relativePath) {
  return [
    "/local-files",
    encodeURIComponent(promptGroup),
    encodeURIComponent(folderName),
    relativePath.split("/").map(encodeURIComponent).join("/"),
  ].join("/");
}

function buildLocalChallenge(rootDir, promptGroup, folderName) {
  const questionDir = path.join(rootDir, promptGroup, folderName);
  if (!isValidQuestionFolder(questionDir)) return null;

  const config = readQuestionConfig(questionDir);
  if (!config) return null;

  const correctAnswers = config.question
    .filter((relativePath) => answerIsCorrect(config.answers, relativePath))
    .map((relativePath) => path.posix.basename(relativePath));

  if (correctAnswers.length === 0) return null;

  return {
    promptGroup,
    folderName,
    selectionMode: correctAnswers.length === 1 ? "single" : "multiple",
    instruction: "请选择符合题干要求的图片",
    promptImages: config.prompt.map((relativePath) => imageUrl(promptGroup, folderName, relativePath)),
    choices: config.question.map((relativePath) => {
      const value = path.posix.basename(relativePath);

      return {
        value,
        imageUrl: imageUrl(promptGroup, folderName, relativePath),
        filePath: relativePath,
      };
    }),
    _correctAnswers: correctAnswers,
    challengeId: crypto.randomUUID(),
  };
}

function getRandomChallenge(rootDir) {
  const groups = scanAll(rootDir);
  if (groups.length === 0) return null;

  const group = groups[Math.floor(Math.random() * groups.length)];
  const folder = group.questions[Math.floor(Math.random() * group.questions.length)];

  return buildLocalChallenge(rootDir, group.prompt, folder);
}

function verifyLocalAnswer(rootDir, promptGroup, folderName, submittedAnswers) {
  const challenge = buildLocalChallenge(rootDir, promptGroup, folderName);
  if (!challenge) return { success: false, correctAnswers: [] };

  const correct = challenge._correctAnswers;
  const submitted = Array.isArray(submittedAnswers)
    ? submittedAnswers.filter((value) => typeof value === "string")
    : [];

  const expected = [...correct].sort();
  const actual = [...submitted].sort();
  const success = expected.length === actual.length && expected.every((value, index) => value === actual[index]);

  return { success, correctAnswers: correct };
}

function listAll(rootDir) {
  return scanAll(rootDir).map((group) => ({
    prompt: group.prompt,
    questions: group.questions.map((questionName) => {
      const challenge = buildLocalChallenge(rootDir, group.prompt, questionName);

      return {
        folderName: questionName,
        promptCount: challenge ? challenge.promptImages.length : 0,
        choiceCount: challenge ? challenge.choices.length : 0,
        answerCount: challenge ? challenge._correctAnswers.length : 0,
        selectionMode: challenge ? challenge.selectionMode : "unknown",
      };
    }),
  }));
}

const scanQuestionFolders = (dir) => scanAll(dir).flatMap((group) => (
  group.questions.map((questionName) => `${group.prompt}/${questionName}`)
));

export {
  buildLocalChallenge,
  getRandomChallenge,
  isValidQuestionFolder,
  listAll as listQuestionFolders,
  scanAll,
  scanQuestionFolders,
  verifyLocalAnswer,
};
