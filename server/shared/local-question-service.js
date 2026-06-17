import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"]);
const PICTURE_DIR = "picture";
const QUESTION_FILE_PATTERN = /^q\d+\.json$/i;

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

function readQuestionConfig(questionFilePath) {
  try {
    const raw = fs.readFileSync(questionFilePath, "utf-8");
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

function fileExistsInside(promptDir, relativePath) {
  const absolutePath = path.resolve(promptDir, relativePath);
  const promptRoot = path.resolve(promptDir);

  if (!absolutePath.startsWith(`${promptRoot}${path.sep}`)) return false;

  try {
    return fs.statSync(absolutePath).isFile();
  } catch {
    return false;
  }
}

function questionFilePath(promptDir, questionName) {
  const normalizedName = path.basename(questionName, ".json").toLowerCase();
  return path.join(promptDir, `${normalizedName}.json`);
}

function questionIdFromFile(fileName) {
  return path.basename(fileName, ".json").toLowerCase();
}

function isValidQuestionFile(promptDir, fileName) {
  if (!QUESTION_FILE_PATTERN.test(fileName)) return false;

  const config = readQuestionConfig(path.join(promptDir, fileName));
  if (!config) return false;

  const files = [...config.prompt, ...config.question];
  return files.every((filePath) => filePath.startsWith(`${PICTURE_DIR}/`) && fileExistsInside(promptDir, filePath));
}

function isValidQuestionFolder(folderPath) {
  const promptDir = path.dirname(folderPath);
  const questionName = path.basename(folderPath);
  return isValidQuestionFile(promptDir, `${questionName}.json`);
}

function scanAll(rootDir) {
  if (!isDirectory(rootDir)) return [];

  const groups = [];
  const promptDirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const promptEntry of promptDirs) {
    const promptPath = path.join(rootDir, promptEntry.name);
    const questionFiles = fs.readdirSync(promptPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isValidQuestionFile(promptPath, entry.name))
      .map((entry) => questionIdFromFile(entry.name))
      .sort((left, right) => left.localeCompare(right));

    if (questionFiles.length > 0) {
      groups.push({ prompt: promptEntry.name, questions: questionFiles });
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
  const promptDir = path.join(rootDir, promptGroup);
  const configPath = questionFilePath(promptDir, folderName);
  const questionId = questionIdFromFile(configPath);

  if (!isValidQuestionFile(promptDir, path.basename(configPath))) return null;

  const config = readQuestionConfig(configPath);
  if (!config) return null;

  const correctAnswers = config.question
    .filter((relativePath) => answerIsCorrect(config.answers, relativePath))
    .map((relativePath) => path.posix.basename(relativePath));

  if (correctAnswers.length === 0) return null;

  return {
    promptGroup,
    folderName: questionId,
    selectionMode: correctAnswers.length === 1 ? "single" : "multiple",
    instruction: "请选择符合题干要求的图片",
    promptImages: config.prompt.map((relativePath) => imageUrl(promptGroup, questionId, relativePath)),
    choices: config.question.map((relativePath) => {
      const value = path.posix.basename(relativePath);

      return {
        value,
        imageUrl: imageUrl(promptGroup, questionId, relativePath),
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
  if (!challenge) return { success: false, correctAnswers: [], imageResults: [] };

  const correct = challenge._correctAnswers;
  const submitted = Array.isArray(submittedAnswers)
    ? submittedAnswers.filter((value) => typeof value === "string")
    : [];

  const expected = [...correct].sort();
  const actual = [...submitted].sort();
  const success = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  const correctSet = new Set(correct);
  const submittedSet = new Set(submitted);
  const imageResults = challenge.choices.map((choice) => {
    const shouldSelect = correctSet.has(choice.value);
    const selected = submittedSet.has(choice.value);

    return {
      promptGroup: challenge.promptGroup,
      folderName: challenge.folderName,
      value: choice.value,
      imageUrl: choice.imageUrl,
      filePath: choice.filePath,
      shouldSelect,
      selected,
      correct: shouldSelect === selected,
    };
  });

  return { success, correctAnswers: correct, imageResults };
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
