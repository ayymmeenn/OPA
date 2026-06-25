# Deployment

The app is packaged as a single Docker image: the React frontend is built and
served by the Flask backend, so the whole thing runs from one URL.

## Run locally with Docker

```bash
docker build -t policyforge .
docker run -p 8000:8000 -e GOOGLE_API_KEY=your-key policyforge
# open http://localhost:8000
```

## Deploy to Render (free, gives a public link)

1. Push this repository to GitHub.
2. Go to https://render.com, sign in, and click **New > Blueprint**.
3. Select this repository. Render reads `render.yaml` and creates the service.
4. In the service's **Environment** settings add `GOOGLE_API_KEY` (your Gemini
   key). `SECRET_KEY` is generated automatically.
5. Wait for the build to finish. Render gives you a live link such as
   `https://policyforge.onrender.com` — share this with the assessor.

## Login details for the demo

| Username  | Password    | Role  |
|-----------|-------------|-------|
| user123   | password123 | user  |
| sarah     | password123 | user  |
| admin123  | qwerty123   | admin |

## Notes

- The free Render tier sleeps after inactivity, so the first request after a
  while can take ~30 seconds to wake up.
- SQLite lives on the container's disk, which resets on redeploy. The sample
  users and policies are re-seeded automatically on startup, so the app always
  has data to show.
