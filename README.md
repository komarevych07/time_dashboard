# Jira Sprint Dashboard

Внутрішній dashboard для відображення задач активного sprint Jira-проєкту `COP`.

## Архітектура

```text
┌───────────────────┐
│     Jira Cloud    │
│   Board COPILOT   │
└─────────┬─────────┘
          │ Jira REST API
          │ (OAuth 2.0)
          ▼
┌───────────────────┐
│  Cloudflare Worker│
│ /api/auth/*       │
│ /api/dashboard    │
└─────────┬─────────┘
          │ HTTPS
          ▼
┌───────────────────┐
│   React + Vite    │
│   GitHub Pages    │
└───────────────────┘
```

Frontend не звертається до Jira напряму — усі запити проходять через Cloudflare Worker.

## Requirements

- Node.js 20 LTS
- npm 10+
- Jira Cloud account
- Cloudflare account
- GitHub account

## Авторизація через Atlassian OAuth 2.0 (3LO)

Dashboard використовує **"Login with Jira"** — OAuth 2.0 (3LO) від Atlassian. Користувач натискає кнопку, підтверджує доступ у Jira, після чого Worker отримує access/refresh токени та працює від імені користувача.

### Налаштування OAuth app

1. Перейдіть до [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/).
2. Натисніть **Create → OAuth 2.0 (3LO) integration**.
3. Увімкніть **Authorization code grants**.
4. Додайте **Callback URL**:
   - Локально: `http://localhost:5173`
   - Production (GitHub Pages): `https://komarevych07.github.io/time_dashboard/`
5. Збережіть **Client ID** та **Client Secret**.
6. У **Permissions** додайте scopes:
   - `read:jira-work` (Classic scopes)
   - `read:jira-user` (Classic scopes)
   - `offline_access`

   > **Примітка:** додаток використовує JQL-пошук через звичайний Jira Platform REST API, тому granular scopes не потрібні.

## Структура проєкту

```text
jira-sprint-dashboard/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # GitHub Pages
│       └── deploy-worker.yml       # Cloudflare Worker
├── src/
│   ├── components/                 # React компоненти
│   ├── hooks/                      # React Hooks
│   ├── services/                   # API клиент
│   ├── types/                      # TypeScript типи
│   ├── utils/                      # categorize, duration, sorting
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── worker/
│   ├── src/
│   │   └── index.ts                # Cloudflare Worker
│   ├── .dev.vars.example           # Приклад локальних secrets
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.toml
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Локальна розробка

### 1. Налаштуйте змінні frontend

```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:8787
VITE_JIRA_CLIENT_ID=your-atlassian-oauth-client-id
VITE_JIRA_REDIRECT_URI=http://localhost:5173
```

### 2. Frontend

```bash
npm install
npm run dev
```

Frontend буде доступний за адресою: http://localhost:5173

### 3. Worker

```bash
cd worker
cp .dev.vars.example .dev.vars
```

Відредагуйте `.dev.vars`:

```env
JIRA_CLIENT_SECRET=your-atlassian-oauth-client-secret
```

Відредагуйте `wrangler.toml`:

```toml
[vars]
JIRA_BASE_URL = "https://your-company.atlassian.net"
BOARD_NAME = "COPILOT"
PROJECT_KEY = "COP"
ALLOWED_ORIGINS = "http://localhost:5173,https://komarevych07.github.io"
JIRA_CLIENT_ID = "your-atlassian-oauth-client-id"
REDIRECT_URI = "http://localhost:5173"
```

Запустіть:

```bash
npm install
npx wrangler dev
```

Worker буде доступний за адресою: http://localhost:8787

## Cloudflare Worker

### 1. Налаштування

```bash
cd worker
```

Оновіть `wrangler.toml` реальними значеннями.

### 2. Збереження Client Secret

Client Secret не можна зберігати у `wrangler.toml` — використовуйте Cloudflare secret:

```bash
npx wrangler login
npx wrangler secret put JIRA_CLIENT_SECRET
```

### 3. Деплой

```bash
npm run deploy
```

Після деплою Worker отримає URL виду:

```text
https://jira-sprint-dashboard-api.YOUR_SUBDOMAIN.workers.dev
```

## GitHub Pages

1. Створіть репозиторій на GitHub.
2. Запуште код:

```bash
git init
git add .
git commit -m "Initial Jira Sprint Dashboard"
git branch -M main
git remote add origin https://github.com/komarevych07/time_dashboard.git
git push -u origin main
```

3. Увімкніть GitHub Pages у налаштуваннях репозиторію:
   - **Settings → Pages → Source: GitHub Actions**.
4. Додайте Repository Variables (**Settings → Secrets and variables → Actions → Variables**):
   - `VITE_API_BASE_URL` → `https://your-worker.workers.dev`
   - `VITE_JIRA_CLIENT_ID` → ваш Atlassian Client ID
   - `VITE_JIRA_REDIRECT_URI` → `https://komarevych07.github.io/time_dashboard/`
5. Додайте Worker Secret у Cloudflare dashboard:
   - `JIRA_CLIENT_SECRET`
6. GitHub Actions автоматично задеплоїть frontend на GitHub Pages.

## Sprint ID (опціонально)

Якщо dashboard не може автоматично знайти активний sprint, на сторінці логіну можна ввести **Sprint ID**.

### Як знайти Sprint ID

1. Відкрийте board у Jira.
2. Перейдіть на вкладку **Active sprints** і виберіть потрібний sprint.
3. У URL браузера знайдіть параметр `sprint=ЧИСЛО`.

Або:

1. Відкрийте будь-яку задачу з sprint.
2. У полі **Sprint** натисніть на назву sprint.
3. У URL буде `sprint=ЧИСЛО`.

Приклад:

```text
https://buntar.atlassian.net/jira/software/c/projects/COP/boards/1375?selectedIssue=COP-1&sprint=2721
```

Sprint ID = `2721`.

## npm scripts

### Frontend

```bash
npm run dev        # Режим розробки
npm run build      # Production build
npm run preview    # Перегляд production build
npm run typecheck  # Перевірка TypeScript
```

### Worker

```bash
npm run dev        # Локальний сервер Wrangler
npm run deploy     # Деплой у Cloudflare
npm run typecheck  # Перевірка TypeScript
```

## Безпека

- Авторизація відбувається через Atlassian OAuth 2.0.
- Access token та refresh token зберігаються лише в memory поточної вкладки браузера.
- Токени не потрапляють у localStorage (окрім короткочасного CSRF `state`), cookies, URL після обробки callback, `.env` чи Git.
- Worker не зберігає токени у persistent storage.
- Client Secret зберігається як Cloudflare secret / `.dev.vars` (не в Git).
- Усі запити йдуть через HTTPS.

## Функціонал

- Відображення задач активного спринта через JQL-пошук.
- Автоматичний пошук active sprint (якщо Sprint ID не вказано).
- Можливість ручного введення Sprint ID на сторінці логіну.
- Завантаження всіх issues sprint з pagination.
- Отримання changelog з pagination.
- Розрахунок `Time in status` на основі останнього transition у поточний status.
- 5 вкладок: FE, BE, QA, Bugs, Інші.
- Сортування по всіх колонках.
- Автооновлення кожні 5 хвилин з оновленням access token при необхідності.
- Ручне оновлення.
- Live duration, що оновлюється щохвилини без додаткових запитів до Jira.
