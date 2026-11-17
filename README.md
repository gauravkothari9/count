# count

Record numbers with the current date and see the running total. MERN stack (MongoDB, Express, React, Node).

## Run locally

```bash
npm install
npm --prefix client install
cp .env.example .env    # then put your MongoDB connection string in it
npm run server          # API on http://localhost:5000
npm run client          # app on http://localhost:3000
```

## Deploy on Vercel

Import this repo in Vercel (the settings come from `vercel.json`), then add one environment variable:

- `MONGODB_URI` — your MongoDB connection string

The React app and the `/api` backend are both served from the same Vercel project.
