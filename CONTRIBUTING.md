# Contributing

Thanks for helping. Before you open a pull request:

1. Run `npm test`. All tests must pass.
2. Keep changes small and focused. Describe what you tested and on which Windows version.
3. Do not add secrets, keys, tokens or personal data. The security tests check for common patterns,
   but you are responsible for what you commit.
4. Do not add network calls to external servers. The app is local-first by design, and the
   security tests enforce this.
5. For features that cannot be verified without a Windows machine, say so in the pull request.

Bug reports are welcome. Include your Windows version, what you pressed and said, what you
expected, and the error text from `maicer.log` (in your user data folder).
