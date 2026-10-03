# Stage E final validation environment

Node v25.9.0 is required; the repository adds no runtime dependency. The retained
Stage D Playwright harness uses the environment's existing Playwright package and
`TFB_BROWSER_EXECUTABLE` may select the browser executable. Actual browser used:
Chromium 151.0.7922.34 with SwiftShader, matching Stage D.

The Playwright CDN installer initially returned a non-ZIP response. The original
official Chrome-for-Testing headless archive was restored and checked by CRC and
SHA-256 (details in `evidence/final/browser-environment.json`). No game renderer,
external runtime version, or inherited test was changed.

The inherited Google Fonts dependency first failed with CERT_AUTHORITY_INVALID.
For the final served-network run, an isolated `XDG_DATA_HOME` directory contained
an NSS database at `pki/nssdb`. The distribution's `libnss3-tools` package was
fetched using signed Ubuntu snapshot metadata and extracted into scratch without
installing system packages. `certutil -N --empty-password` initialized the scratch
database. Only certificates already passing `openssl verify` against the existing
system CA bundle were imported using `certutil -A -t 'C,,'`.

The existing system/user trust stores were not edited. No ignore-certificate flag,
request interception, mocked font response or TLS bypass was used. The original
strict network assertion passed after this environment setup. Package verification
uses the same isolated environment. Certificate and utility hashes are recorded
in `evidence/final/certificate-provenance.json`; no certificates, browser binaries
or package manager cache are included in the game ZIP.

Chromium's NSS directory selection is documented in its primary source:
https://chromium.googlesource.com/chromium/src/+/HEAD/crypto/nss_util.cc
The legacy home database was absent in this test environment, allowing the scratch
XDG directory. A different machine should use its own valid trust configuration;
these certificate identities are environment provenance, not application settings.

Exact elapsed-time screenshot parity is a separate check. The retained harness
was diagnosed against the parent itself; 0/1 ms performance-origin differences
changed breathing/light pixels. The additive controlled harness advances to
exactly 1000 ms before menu capture and 2000 ms before gameplay capture. Both
fallback-font and fully loaded-font contexts produced exact parent/current PNG
and state equality. The game and retained Stage D assertions remain unchanged.

Historical logs preserve commands and paths from their execution machines.
Maintained harnesses resolve from their own file location. A final gitless
extraction into a different path with spaces validates portability. Hardware-GPU
performance and human gameplay QA remain unverified.
