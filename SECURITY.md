# Security

## Reporting vulnerabilities

Please report suspected vulnerabilities privately through the repository's
GitHub security advisory process rather than opening a public issue with
exploitation details.

## Local SAST scans

TimeScope uses [Opengrep](https://github.com/opengrep/opengrep) for open-source
static application security testing. Install the latest CLI with:

```sh
curl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash
```

The installer places the CLI under `~/.opengrep/cli/` and creates a `latest`
symlink. A specific release can be installed with:

```sh
curl -fsSL https://raw.githubusercontent.com/opengrep/opengrep/main/install.sh | bash -s -- -v <version>
```

Run the repository scan locally from the project root:

```sh
pnpm security:opengrep
```

This uses Opengrep's automatic rules and fails locally when findings are
reported. The same scan runs on pushes and pull requests through
`.github/workflows/opengrep.yml`; SARIF results are uploaded to GitHub Code
Scanning. CI currently reports findings without blocking PRs while the initial
baseline is triaged.

For interactive inspection, start the local Opengrep visual inspection server:

```sh
pnpm security:opengrep:server
```

The server is available at <http://localhost:8080>.

Advanced Opengrep features such as interfile analysis may be alpha-quality. Do
not treat alpha results as a substitute for review or targeted tests.

## CodeQL analysis

GitHub CodeQL provides complementary semantic analysis for the repository's
JavaScript and TypeScript code. The workflow is defined in
`.github/workflows/codeql.yml` and runs on:

- Pull requests targeting `main` or `master`
- Pushes to `main` or `master`
- A weekly scheduled scan

CodeQL results are published to GitHub's **Security → Code scanning** view. The
workflow uses the pinned CodeQL Action v4 release, requests only read access to
repository and pull-request metadata plus `security-events: write`, and uses
`build-mode: none`, which is appropriate for JavaScript/TypeScript analysis in
this project. It does not replace tests, dependency review, Opengrep, or manual
security review.
