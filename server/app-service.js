import express from "express";
import cookieParser from "cookie-parser";
import {
  consumeTicket,
  createClientId,
} from "./shared/captcha-store.js";
import { appHomePage, goodsDetailPage } from "./shared/html.js";

const appServicePort = 4174;
const captchaServiceUrl = "http://127.0.0.1:4175";

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

function requireCaptcha(request, response, next) {
  const returnTo = request.path;
  const ticket = request.query.captchaTicket;

  if (typeof ticket === "string" && consumeTicket(ticket, request.clientId, returnTo)) {
    return next();
  }

  const redirectUrl = `${captchaServiceUrl}/challenge?returnTo=${encodeURIComponent(returnTo)}`;
  return response.redirect(302, redirectUrl);
}

function startAppService() {
  const app = express();
  app.use(cookieParser());
  app.use(ensureClientId);

  app.get("/", requireCaptcha, (request, response) => {
    response.send(appHomePage());
  });

  app.get("/goods", requireCaptcha, (request, response) => {
    response.send(goodsDetailPage({ currentPath: request.path }));
  });

  app.get("/data/goods", requireCaptcha, (request, response) => {
    response.send(goodsDetailPage({ currentPath: request.path }));
  });

  return app.listen(appServicePort, () => {
    console.log(`App service listening on http://127.0.0.1:${appServicePort}`);
  });
}

export { startAppService, appServicePort };
