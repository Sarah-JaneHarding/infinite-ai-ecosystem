# Library source

This folder is the supplied Infinite-AI document library (120 business documents, each in four or five formats, plus `manifest.json`), committed byte-for-byte as received. Do not edit it: the Document Studio holds every edit as a revision, and `packages/contracts/test/library-corpus.spec.ts` checks each file against its SHA-256 in `manifest.json`. `README.md` is the vendor's own; the npm scripts it mentions do not exist in this repository.
