# Captcha Demo

A demo project with:

- a protected product website
- a standalone captcha service
- configurable captcha UI settings
- extensible question banks for text, image, and custom challenges

The current demo includes a virtual product homepage and product detail page, while every protected visit is gated by the captcha service first.

## Features

- Two independent backend services
  - App service: `http://127.0.0.1:4174`
  - Captcha service: `http://127.0.0.1:4175`
- Protected routes
  - `/`
  - `/goods`
  - `/data/goods`
- Every direct visit to a protected page redirects to the captcha service
- Successful verification returns the user to the original page with a one-time ticket
- Failed verification retries automatically
- Lockout after 5 failures with a 5-minute cooldown
- UI setting panel for:
  - theme color
  - language
  - captcha mode
- Captcha modes
  - letter selection
  - image selection
  - custom challenges
- Supports:
  - single-select questions
  - multi-select questions
  - up to 9 grid items per question

## Project Structure

```text
server/
  app-service.js
  captcha-service.js
  index.js
  shared/
    captcha-store.js
    html.js
    question-bank.js
```

## How It Works

### App service

The app service renders the protected product pages.

- `GET /`
- `GET /goods`
- `GET /data/goods`

When a user visits one of these pages directly, the request is redirected to the captcha service unless a valid one-time captcha ticket is present.

### Captcha service

The captcha service renders the captcha page and verifies answers.

- `GET /challenge`
- `POST /verify`

It also manages:

- challenge generation
- refresh behavior
- single-select and multi-select validation
- failure counting
- cooldown lock state

## Question Bank Format

The question bank lives in:

- [server/shared/question-bank.js](D:\Project\CapthaDemo\server\shared\question-bank.js)

Questions are grouped by mode:

```js
const QUESTION_BANK = {
  letter: [],
  image: [],
  custom: [],
};
```

Each question uses this format:

```js
{
  id: "unique-id",
  selectionMode: "single" | "multiple",
  prompt: {
    en: "English prompt",
    zh: "Chinese prompt"
  },
  answers: ["correct-value-1", "correct-value-2"],
  choices: [
    {
      value: "option-value",
      label: "display text or localized object",
      hint: {
        en: "Choice 1",
        zh: "候选 1"
      },
      kind: "text" | "image" | "custom",
      image: "optional image url or data url"
    }
  ]
}
```

Rules:

- `id` must be unique
- `selectionMode` must be `single` or `multiple`
- `answers` must be an array
- `choices` can contain at most 9 items
- every answer must exist in `choices[].value`

## Local Development

Install dependencies:

```powershell
cd D:\Project\CapthaDemo
cmd /c npm install
```

Start the services:

```powershell
node server/index.js
```

Then open:

- [http://127.0.0.1:4174/](http://127.0.0.1:4174/)
- [http://127.0.0.1:4174/goods](http://127.0.0.1:4174/goods)

## Notes

- The captcha page is rendered by the backend directly
- The product pages are plain server-rendered pages
- Refreshing a protected business page will trigger captcha again because the ticket is one-time use
- The refresh button on the captcha page forces a new challenge in the current mode

## Suggested Next Steps

- move question banks into standalone JSON files
- add an admin editing interface for challenge management
- add image assets from a real media folder instead of inline SVG data URLs
- persist sessions in Redis or a database instead of in-memory Maps
