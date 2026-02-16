# BBOY ZERO Website (Static + Supabase)

Project path:
- `/Users/bboyzero/Documents/bboyzero.net site`

## Architecture

- Static frontend (HTML/CSS/JS)
- Supabase Postgres for events + contact messages
- Supabase Storage for uploaded event images
- No backend server required for production static deploy

## 1. Supabase setup

Run this SQL in Supabase SQL Editor:
- `/Users/bboyzero/Documents/bboyzero.net site/supabase/schema.sql`

This creates:
- `public.events`
- `public.messages`
- RLS policies for static client usage
- storage bucket + storage policies for `event-images`

## 2. Configure frontend Supabase keys

Edit:
- `/Users/bboyzero/Documents/bboyzero.net site/js/supabase-config.js`

Set real values:
- `url` = your Supabase project URL
- `anonKey` = your Supabase anon key
- `storageBucket` = `event-images`

## 3. Create admin user (for event edits)

In Supabase dashboard:
- Authentication -> Users -> Add user

Use that email/password in the Events page admin sign-in.
Only authenticated users can add/delete events and upload event images.

## 4. Test locally (static)

From project folder, run a simple static server. Example:

```bash
cd "/Users/bboyzero/Documents/bboyzero.net site"
python3 -m http.server 8080
```

Open:
- `http://localhost:8080`

## 5. Publish on Render Static Site

1. Render -> New -> Static Site
2. Connect GitHub repo: `bboyyzero/bboyzero-net-site`
3. Build command: leave blank
4. Publish directory: `.`
5. Deploy

No private env vars are required for this static setup because the frontend uses Supabase URL + anon key in `js/supabase-config.js`.

## 6. Connect domain

1. In Render Static Site -> Custom Domains, add your domain
2. At your registrar, add DNS records exactly as Render shows
3. Wait for DNS + SSL to finish

## Notes

- `server.js` is legacy and not needed for static deploy.
- Contact messages are write-only from client (no client read policy).
