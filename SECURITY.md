# Security status

Patchwork stores campaign data in a local SQLite database. The server encrypts OAuth credentials and checks each draft against the reviewed copy before applying a change. Live OAuth and hosted operation still need verification. See the [security and privacy notes](docs/engineering/security-and-privacy.md) for controls and retention.

## Do not publish sensitive reports

Never put credentials, tokens, authorization codes, private draft text or personal account screenshots in a public issue or pull request. A dedicated private reporting channel has not been configured by this repository work. Arrange a verified private channel with the maintainer before sharing sensitive details; do not assume a public thread is confidential.
