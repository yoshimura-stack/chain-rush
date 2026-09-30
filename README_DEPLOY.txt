CHAIN RUSH V0.13.1 - Cloudflare deploy package

GitHub repository root should contain:
  public/
  wrangler.jsonc
  package.json
  .gitignore
  README_DEPLOY.txt

Cloudflare settings:
  Build command: (blank)
  Deploy command: npx wrangler deploy
  Root directory: /

Only ./public is published as static assets. node_modules is never included in assets.
