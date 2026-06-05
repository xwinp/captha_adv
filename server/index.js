import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAppService } from "./app-service.js";
import { startCaptchaService } from "./captcha-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localQuestionsDir = path.join(__dirname, "local-questions");

startCaptchaService({ localQuestionsDir });
startAppService();
