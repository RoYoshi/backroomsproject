# Stage I externally verified checkpoints

| Milestone | Remote commit | Remote tree | Verification |
|---|---|---|---|
| Accepted H | 692eebd338cc42347d437b0c0a2dcc9d7217ac34 | 1cd5430b61aac7f994da29f4879621a638c49526 | GitHub API, fetched Git and complete accepted ZIP |
| I0 | 6141e5caf1d0d417e77a2ceb6e4b54742c5d027d | f4d4ae52159da6d4aa85db9744de06c1d549ebab | GitHub branch API and independently fetched SHA/tree |
| I1 | c6e233947722b4eb7de9172076903912987bd78f | 813c4b24b90e820658e8eb2ec0f366e94b0ed0dd | Connector fast-forward and independently fetched SHA/tree |
| I2 preservation | 007c328cd984a8148285b47650874389768332c3 | e3c3dd2aefc99fefacba9f18ce3d5af2f23c2245 | Raw soak readiness failure preserved; independently fetched |
| I2 browser/stress preservation | c47cb1c6804c12aed2033b4f47a241b89771879c | 3079a9c3e15ec73b7f5a5d09fb762d21a95f36e3 | Connected GitHub fast-forward; independent fetch SHA/tree match |
| I2 | a64117fdf3798f3c483dc602ca34ed6d3804b18d | 1973c94319daca2d93b239b68bf4990f552e90ed | Connected GitHub fast-forward; independent fetch SHA/tree match |
| I3 | d716d493cf0feea870e199090592fb9ce9912c7e | 5cedb5b9fcb032803f562194e88280360c8cb45e | Connected GitHub fast-forward; independent fetch SHA/tree match |
| I4 retained/source preservation | 842b2ec681d1ec3c95260ce808bf52d9e27f3416 | 0b6cafc5dab658a58e5f5de1103e95faaaf5123d | Connected GitHub fast-forward; independent fetch SHA/tree match |

The shell's public checkout is read-only. Authorized writes use the connected GitHub app, preserving exact local tree hashes and fast-forward ancestry. Final self-referential identities belong in external publication receipts.
