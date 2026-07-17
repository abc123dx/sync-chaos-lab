# Security policy

## Supported versions

Security fixes are applied to the latest `0.1.x` release while the project is
in its initial development phase.

## Reporting

Use GitHub private vulnerability reporting from the repository's **Security**
tab when it is available. Include:

- the affected version or commit;
- a minimal reproduction;
- expected and observed behavior;
- impact and any known mitigations.

Do not include credentials, private document contents, access tokens or other
secrets in a public issue. If private reporting is unavailable, open a public
issue containing only sanitized metadata and request that a private channel be
enabled.

## Scope

Potential reportable issues include unsafe HTML report generation, arbitrary
file writes outside an explicitly selected output path, dependency compromise,
or crafted CRDT payloads that cause unexpected code execution.

Incorrect convergence results without a security impact should use the normal
bug-report workflow.
