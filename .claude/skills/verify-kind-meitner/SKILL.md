---
name: verify-kind-meitner
description: "Verify kind-meitner server and conversation changes against an isolated fake-engine instance before claiming they work."
---

# Verify kind-meitner

Follow the canonical instructions in `docs/verification/README.md`. Use its
shared control tool; do not improvise raw API calls or drive the user's live
kind-meitner instance. The canonical feature map currently covers only the
server flows that tool can prove.
