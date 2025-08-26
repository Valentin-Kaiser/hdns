# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS frontend

COPY . /app
WORKDIR /app/application/frontend

RUN npm install -g @angular/cli@latest && \
    npm install -g @ionic/cli@latest && \ 
    npm install && \
    ionic build --prod

FROM golang:1.24-bookworm AS backend

COPY --from=frontend /app /app

WORKDIR /app/application/backend

RUN go mod tidy && \
    GIT_TAG=$(git describe --tags || echo "unknown") && \
    GIT_COMMIT=$(git rev-parse HEAD) && \
    GIT_SHORT=$(git rev-parse --short HEAD) && \
    BUILD_TIME=$(date +%FT%T%z) && \
    VERSION_PACKAGE=github.com/Valentin-Kaiser/go-core/version && \
    go mod tidy && \
    go build -ldflags "-X ${VERSION_PACKAGE}.GitTag=${GIT_TAG} -X ${VERSION_PACKAGE}.GitCommit=${GIT_COMMIT} -X ${VERSION_PACKAGE}.GitShort=${GIT_SHORT} -X ${VERSION_PACKAGE}.BuildDate=${BUILD_TIME}" \
    -o /hdns cmd/main.go

FROM debian:bookworm-slim

WORKDIR /
COPY --from=backend /hdns /hdns

ARG CURL_VERSION=7.88.*

RUN apt-get update && apt-get install -y curl=${CURL_VERSION} && apt-get clean

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
CMD curl -f http://localhost:8080 || exit 1

EXPOSE 8080/tcp

ENTRYPOINT ["./hdns"]