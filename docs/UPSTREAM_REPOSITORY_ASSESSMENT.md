# Upstream Repository Assessment

## Scope

This note records the initial public-source comparison between this local demo and the upstream repository at <https://github.com/monerochan-ecosystem/monero-wallet-api/tree/master>. It does not make a claim that the upstream repository exposed a credential.

## Findings recorded on 2026-08-19

The local demonstration consumes the published `@spirobel/monero-wallet-api` prebuilt distribution through `scripts/vendor-wallet-api.sh`. It does not copy an upstream project configuration, deployment scaffold, database configuration, or cloud-provider credential file.

The upstream repository's public recursive Git tree was inspected through GitHub's API. Its tracked paths contained no matches for `.project-config`, TiDB, Cloudflare, artifact, Drizzle, MySQL, environment-file, or GitHub workflow paths. The only configuration-adjacent match was `rust/Dockerfile`.

The credential-bearing `.project-config.json` found in the earlier local repository was therefore an inherited local full-stack template artifact, not evidence of an upstream `monero-wallet-api` tracked-file exposure. No upstream warning or public issue should be submitted on the basis of this evidence alone.

## Further action threshold

Before contacting upstream, obtain a concrete upstream commit, release tarball, published package artifact, or upstream-controlled configuration file containing an actual credential or reproducible evidence of credential exposure. Otherwise, report the local template cleanup only and do not attribute it to the upstream project.

## Public security contact status

GitHub's public security page for the upstream repository was inspected on 2026-08-19. It reports that no `SECURITY.md` policy is configured and that no security advisories are published. If concrete upstream evidence is later obtained, contact the maintainers privately through a verified channel before opening a public issue; this assessment does not justify contacting them now.

## Confirmed local provenance of the removed configuration

The local Git history provides stronger evidence about the removed `.project-config.json` than the earlier assessment stated. The initial repository commit, `d11c82810dd6d0aa98fbcb4c97d0895ee528a7af`, is labelled **Initial project bootstrap**, is authored by `Manus <dev-agent@manus.ai>`, and contains the full managed React/tRPC/Drizzle scaffold. That initial commit does **not** track `.project-config.json`; its initial `.gitignore` already excludes that exact filename. No commit or retained modular archive contains the file.

The initial remote is a managed `artifacts.cloudflare.net/git/prod/...` project artifact endpoint, not the user’s GitHub repository and not the `monerochan-ecosystem/monero-wallet-api` repository. Taken together, these facts establish that the credential file was generated as untracked managed-project configuration alongside the initial Manus full-stack scaffold. They do not establish which human or service principal created the underlying provider credentials, because the file was intentionally untracked and its contents are no longer retained.
