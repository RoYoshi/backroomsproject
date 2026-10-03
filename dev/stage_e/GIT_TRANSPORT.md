# Checkpoint transport

The repository was cloned at the verified E0 commit. Command-line Git can read
the repository, but pushing fails because that execution context has no HTTPS
credential. The connected GitHub integration creates each milestone's exact
source tree, then advances `stage-e` without force. Every resulting tree SHA is
compared with the local committed tree before publication.

GitHub-created commits have different author/time metadata from the local
checkpoint commits. Both histories are retained; no reset, clean, forced ref
update, merge to main, or discarded work is used. The final checkpoint ledger
lists authoritative GitHub SHAs and their corresponding local source trees.
Recovery ZIP verification records both local and remote commit identities.
