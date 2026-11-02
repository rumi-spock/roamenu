# Roamenu

Mobile menu scanning product with a dedicated Roamenu backend and authentication service.

Shared-menu links use `https://roamenu.vercel.app` in production. Local development can override this with `EXPO_PUBLIC_PUBLIC_SITE_URL` in `.env.local`; the standalone website can run on `http://localhost:3001`.

The product name is provisional.

## Workspace projects

- `roamenu`: Expo mobile app
- `../roamenu-website`: public handoff website and API/authentication service

Open `roamenu.code-workspace` to load all three projects together.

## Local development

Run each project in its own terminal:

```sh
cd ../roamenu-website && npm install && npm run dev
npm install && npm run start
```

The website and API use port `3001`, and Expo uses its usual development port. Configure local origins and API addresses in each project's `.env.local`; safe templates are provided in `.env.example` files.
