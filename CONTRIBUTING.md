# Contributing to LiveLift

Thanks for your interest. The current product is the Next.js application in [`next/`](next). The Python code in `src/`, `tests/` and `web/` belongs to the original research project and follows its own [legacy guide](docs/legacy/ORIGIN-CONTRIBUTING.vi.md) and [HARNESS.md](HARNESS.md).

## Set up

Use Node **22.23.3**, the certified version.

```bash
cd next
npm ci
cd .. && ./start-livelift-demo     # SIMULATED rehearsal on http://localhost:3130
```

## Before opening a pull request

Run from `next/`; all must pass:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If you change a user-facing flow, also run the browser harness described in [FINAL-CERTIFICATION.md](docs/competition/FINAL-CERTIFICATION.md). In the pull request, say what changed and paste the commands you ran with their summary lines.

## Ground rules

- **Keep the evidence model intact.** Missing is not zero, planned is not actual, recommendation is not acceptance, operator reported is not provider observed, REAL is not SIMULATED, observation is not causation, and later evidence is never shown as known during the LIVE. A change that blurs one of these will not be merged, however convenient.
- **Do not weaken tests to make them pass.** Fix the cause; when a fix changes intended behaviour, explain why in the pull request.
- **Never commit secrets.** Configuration goes in a protected environment file; `next/.env.production.example` contains placeholders only. Screenshots must not show credentials or personal data.
- **Do not claim platform capability you have not verified.** Fixture or simulated data must stay labelled as such in code, UI and documentation.
- **Keep changes focused.** One concern per pull request, with a commit message that says what changed and why.

## Reporting security issues

Please do not open a public issue with exploit details. Use GitHub's private vulnerability reporting for this repository if it is enabled; otherwise open an issue that only asks for a private contact.

## License

By contributing you agree that your contribution is licensed under the [AGPL-3.0-only](LICENSE) license of this project.
