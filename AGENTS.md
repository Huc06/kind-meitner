# kind-meitner agent notes

Before claiming a server or conversation change works, follow
[`docs/verification/README.md`](docs/verification/README.md). Always launch an
isolated fixture; never verify mutations against the user's live app or data.

More specific `AGENTS.md` files override this note within their directories.

## Pull request workflow

- Create one branch and one pull request for one GitHub issue and one logical
  outcome. Use `.github/pull_request_template.md` and link the issue as
  `#<number>`; do not use Linear identifiers.
- Put material scope, architecture, trade-off, or follow-up decisions in the
  pull request's GitHub comments so reviewers have an auditable discussion.
- After implementation and targeted verification, research the relevant public
  feature documentation or current behavior. Then re-review the complete diff
  in light of that research before marking the task/PR ready. Record material
  findings, sources, and resulting changes in the PR body or comments.
- Do not mark a PR ready for review until its scoped tests are recorded, CI is
  green, it is current with its target branch, and unrelated changes are
  removed.
