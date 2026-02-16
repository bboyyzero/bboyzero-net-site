# BBOY ZERO Website

Simple multi-page site with:
- Home (`index.html`)
- Events (`events.html`) with admin control
- Contact (`contact.html`) with social links and message form

Project path:
- `/Users/bboyzero/Documents/bboyzero.net site`

## Supabase Setup

1. In Supabase SQL editor, run:
- `/Users/bboyzero/Documents/bboyzero.net site/supabase/schema.sql`

2. Create a Storage bucket:
- Name: `event-images`
- Public bucket: `ON`

3. Create local env file:
- Copy `.env.example` to `.env`
- Fill in:
  - `BBOY_ADMIN_TOKEN=...`
  - `SUPABASE_URL=...`
  - `SUPABASE_SERVICE_ROLE_KEY=...`
  - `SUPABASE_STORAGE_BUCKET=event-images` (or your bucket name)

## Run the site

From `/Users/bboyzero/Documents/bboyzero.net site`:

```bash
node server.js
```

Open:
- `http://localhost:3000`

## Admin events control

1. Go to `events` page.
2. Click `admin`.
3. Enter the same token as `BBOY_ADMIN_TOKEN`.
4. Add/delete events.
5. Upload event image directly via `event image upload` or paste an image URL.

## Data storage now

Supabase Postgres:
- `public.events`
- `public.messages`

Supabase Storage:
- Bucket: `event-images`
- Path prefix: `events/`

## Website files

- `/Users/bboyzero/Documents/bboyzero.net site/index.html`
- `/Users/bboyzero/Documents/bboyzero.net site/events.html`
- `/Users/bboyzero/Documents/bboyzero.net site/contact.html`
- `/Users/bboyzero/Documents/bboyzero.net site/styles.css`
- `/Users/bboyzero/Documents/bboyzero.net site/js/events.js`
- `/Users/bboyzero/Documents/bboyzero.net site/js/contact.js`
- `/Users/bboyzero/Documents/bboyzero.net site/server.js`
