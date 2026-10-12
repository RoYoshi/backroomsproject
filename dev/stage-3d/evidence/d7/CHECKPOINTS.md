# Stage 3D checkpoints

Branch `stage-3d`, from the accepted parent `stage-3h0` 06949a8a4204a1ce8144b87b2192251b259b21ec (tree 5adf3f3cde5c1a52775f561c36facda646f3cca8). Each was pushed normally and verified on GitHub after its push (`dev/stage-3d/verify_remote_3d.py`):
- the remote branch head and the GitHub API agree with the local commit and tree;
- the commit's parent is the previous checkpoint;
- no merge;
- `main`, `stage-3h0` and every other branch unmoved.

| | Commit | Tree | Verification |
|---|---|---|---|
| D0 | f22b207728f408a683b149434fd6792bc01a270a | ae8e129410d192e7111c50dbb5ea03af1fe47ce7 | `../d1/remote_d0.json` |
| D1 | bbf3e887ef4d440f8d4d14aea0c934eb4a339e7f | 6cd0c882dea86cfb254cf255d26c52aaada5ff38 | `remote_d1.json` |
| D2 | efb81ec0540522c2819edd8d03951e353a2ae7c9 | eed7545d6706849d7f2d4712420cbcde986185c1 | `remote_d2.json` |
| D3 | 56f87d47632f8eb194e8d23f476de90428f0b929 | 2ecc02b8cb78ca2aed86ca8b32214503216bebc3 | `remote_d3.json` |
| D4 | ee5b8e64e4d124b2f569d19f62f5327c623f0d4e | 897b7c4ca7301f196a19a5ec450f2e9a21e746bf | `remote_d4.json` |
| D5 | 6bc27a9e0108a3b78c2a7176d5665d85d686af90 | 47cdd0ea7b847f194f7faba7daeb516b4b93b28e | `remote_d5.json` |
| D6 | 8d6e66a6531ca413636d6c184054bbc41dba871b | 6e7fe9231916c2a1dd640e71474fe8a260c89173 | `remote_d6.json` |
| D7 | the commit that holds this file | – | in `STAGE_3D_PACKAGE_RECEIPT.txt`, delivered with the ZIP |

A commit cannot contain its own hash. D7's commit, tree and remote verification are therefore in the package receipt, made from the pushed D7 commit. The receipt also checks that the ZIP is exactly that commit's files.
