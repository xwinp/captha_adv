import crypto from "node:crypto";
import { buildQuestion, normalizeLanguage, normalizeMode } from "./question-bank.js";

const challengeTtlMs = 3 * 60 * 1000;
const ticketTtlMs = 60 * 1000;
const cooldownMs = 5 * 60 * 1000;
const maxFailures = 5;

const sessions = new Map();
const tickets = new Map();

function now() {
  return Date.now();
}

function cleanup() {
  const current = now();

  for (const [clientId, session] of sessions.entries()) {
    if (session.challengeExpiresAt && session.challengeExpiresAt <= current) {
      session.challenge = null;
      session.returnTo = null;
      session.challengeExpiresAt = 0;
    }

    if (session.lockedUntil && session.lockedUntil <= current) {
      session.failures = 0;
      session.lockedUntil = 0;
    }

    if (!session.challenge && !session.lockedUntil && session.failures === 0) {
      sessions.delete(clientId);
    }
  }

  for (const [ticketId, ticket] of tickets.entries()) {
    if (ticket.expiresAt <= current) {
      tickets.delete(ticketId);
    }
  }
}

function createClientId() {
  return crypto.randomUUID();
}

function getSession(clientId) {
  cleanup();

  if (!sessions.has(clientId)) {
    sessions.set(clientId, {
      failures: 0,
      lockedUntil: 0,
      challenge: null,
      returnTo: null,
      challengeExpiresAt: 0,
    });
  }

  return sessions.get(clientId);
}

function getLockState(clientId) {
  const session = getSession(clientId);
  const remainingMs = Math.max(0, session.lockedUntil - now());

  return {
    locked: remainingMs > 0,
    remainingMs,
    failures: session.failures,
  };
}

function createChallenge(clientId, returnTo, options = {}) {
  const session = getSession(clientId);
  const mode = normalizeMode(options.mode);
  const language = normalizeLanguage(options.language);
  const question = buildQuestion(mode, language, {
    excludeId: options.excludeQuestionId,
  });

  session.challenge = {
    id: crypto.randomUUID(),
    answers: question.answers,
    choices: question.choices,
    instruction: question.instruction,
    selectionMode: question.selectionMode,
    mode,
    language,
    questionId: question.id,
  };
  session.returnTo = returnTo;
  session.challengeExpiresAt = now() + challengeTtlMs;

  return session.challenge;
}

function getOrCreateChallenge(clientId, returnTo, options = {}) {
  const session = getSession(clientId);
  const mode = normalizeMode(options.mode);
  const language = normalizeLanguage(options.language);
  const forceRefresh = options.forceRefresh === true;

  if (
    !forceRefresh &&
    session.challenge &&
    session.returnTo === returnTo &&
    session.challengeExpiresAt > now() &&
    session.challenge.mode === mode &&
    session.challenge.language === language
  ) {
    return session.challenge;
  }

  return createChallenge(clientId, returnTo, {
    mode,
    language,
    excludeQuestionId: forceRefresh && session.challenge ? session.challenge.questionId : "",
  });
}

function registerFailure(clientId, returnTo, options = {}) {
  const session = getSession(clientId);
  session.failures += 1;
  session.challenge = null;
  session.returnTo = null;
  session.challengeExpiresAt = 0;

  if (session.failures >= maxFailures) {
    session.lockedUntil = now() + cooldownMs;
    return {
      locked: true,
      remainingMs: cooldownMs,
      failures: session.failures,
    };
  }

  createChallenge(clientId, returnTo, options);

  return {
    locked: false,
    remainingMs: 0,
    failures: session.failures,
  };
}

function normalizeAnswers(input) {
  if (Array.isArray(input)) {
    return input.filter((value) => typeof value === "string");
  }

  if (typeof input === "string" && input.length > 0) {
    return [input];
  }

  return [];
}

function sameAnswerSet(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

function verifyChallenge(clientId, returnTo, submittedAnswers, options = {}) {
  const session = getSession(clientId);
  const mode = normalizeMode(options.mode);
  const language = normalizeLanguage(options.language);
  const answers = normalizeAnswers(submittedAnswers);

  if (session.lockedUntil > now()) {
    return {
      ok: false,
      reason: "locked",
      remainingMs: session.lockedUntil - now(),
      failures: session.failures,
    };
  }

  if (
    !session.challenge ||
    session.challengeExpiresAt <= now() ||
    session.returnTo !== returnTo ||
    session.challenge.mode !== mode ||
    session.challenge.language !== language
  ) {
    createChallenge(clientId, returnTo, { mode, language });
    return {
      ok: false,
      reason: "expired",
      failures: session.failures,
    };
  }

  if (!sameAnswerSet(session.challenge.answers, answers)) {
    const failureState = registerFailure(clientId, returnTo, { mode, language });
    return {
      ok: false,
      reason: failureState.locked ? "locked" : "mismatch",
      remainingMs: failureState.remainingMs,
      failures: failureState.failures,
    };
  }

  session.failures = 0;
  session.lockedUntil = 0;
  session.challenge = null;
  session.returnTo = null;
  session.challengeExpiresAt = 0;

  const ticketId = crypto.randomUUID();
  tickets.set(ticketId, {
    clientId,
    returnTo,
    expiresAt: now() + ticketTtlMs,
  });

  return {
    ok: true,
    ticketId,
  };
}

function consumeTicket(ticketId, clientId, returnTo) {
  cleanup();
  const ticket = tickets.get(ticketId);

  if (!ticket) {
    return false;
  }

  tickets.delete(ticketId);

  return ticket.clientId === clientId && ticket.returnTo === returnTo;
}

function formatRemaining(remainingMs) {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export {
  consumeTicket,
  createClientId,
  formatRemaining,
  getLockState,
  getOrCreateChallenge,
  maxFailures,
  normalizeLanguage,
  normalizeMode,
  verifyChallenge,
};
