# Runtime image only - build happens in CI
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:22-slim

WORKDIR /app

# Copy pre-built output from CI
COPY .output /app/.output

ENV NODE_ENV=production

EXPOSE 3000

CMD [".output/server/index.mjs"]