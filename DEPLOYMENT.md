# Deployment

The app is packaged as a single Docker image: the React frontend is built and
served by the Flask backend, so the whole thing runs from one URL.

## Run locally with Docker

```bash
docker build -t policyforge .
docker run -p 8000:8000 -e GOOGLE_API_KEY=your-key policyforge
# open http://localhost:8000
```

## Login details

| Username  | Password    | Role  |
|-----------|-------------|-------|
| user123   | password123 | user  |
| sarah     | password123 | user  |
| admin123  | qwerty123   | admin |
