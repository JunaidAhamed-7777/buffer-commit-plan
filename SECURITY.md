# Security status

Patchwork is currently a documentation and directory skeleton. No deployed service, OAuth client, application implementation or credential store exists in this repository.

The [security and privacy design](docs/engineering/security-and-privacy.md) describes planned controls, not verified protection. Future implementation must test authorization, OAuth handling, private draft storage, stale reviews and uncertain external writes.

## Do not publish sensitive reports

Never put credentials, tokens, authorization codes, private draft text or personal account screenshots in a public issue or pull request. A dedicated private reporting channel has not been configured by this repository work. Arrange a verified private channel with the maintainer before sharing sensitive details; do not assume a public thread is confidential.

No vulnerability-response timeline or operational security guarantee is promised at this pre-implementation stage.
