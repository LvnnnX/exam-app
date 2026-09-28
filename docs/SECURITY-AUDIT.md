# Security audit notes

## Current dependency audit status

`npm audit --audit-level=high` must pass before deploy.

As of the OWASP baseline pass, `npm audit` still reports moderate `postcss` findings through `next`. Do not run `npm audit fix --force` for this finding because npm currently suggests a breaking Next downgrade path. Track the upstream Next/PostCSS patch and update Next normally when a compatible release is available.

## Required gates

Run before production deploy:

```sh
npm run build
npm run test:api-security
npm run test:rls
npm run audit:high
```

`npm run lint` should also be kept at zero errors. Warnings are existing cleanup debt and should be reduced over time.
