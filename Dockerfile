FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY my_agent/frontend/package*.json ./
RUN npm install
COPY my_agent/frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY my_agent/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY my_agent/backend/ ./
COPY --from=frontend /frontend/build ./frontend_build
ENV FRONTEND_BUILD=/app/frontend_build
CMD gunicorn --bind 0.0.0.0:${PORT:-8000} app:app
