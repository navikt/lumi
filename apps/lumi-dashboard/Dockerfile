# Runtime image only - build happens in CI
FROM europe-north1-docker.pkg.dev/cgr-nav/pull-through/nav.no/node:24-slim

WORKDIR /app

# Copy pre-built output from CI and assign ownership to the non-root runtime user.
COPY --chown=node:node .output /app/.output

ENV NODE_ENV=production

EXPOSE 3000

# Drop root privileges explicitly at runtime.
# Chainguard Node runs as non-root `node` by default (UID 65532), but we keep this explicit.
USER node

# Chainguard Node image uses `node` as entrypoint, so this path is passed as the script argument.
CMD [".output/server/index.mjs"]
