<!-- ai-coding-master-workflow v2 -->
# Skills per stage

Use a skill only when the task needs it. Skip it for small or clear work.

| Stage | Technical | Design (impeccable) |
|---|---|---|
| study | `grilling`, then `domain-modeling`, when scope or terms are unclear; `research` for primary sources; `prototype` to test logic before planning | `/impeccable shape [feature]`; `/impeccable init` once if PRODUCT.md is missing, `/impeccable document` once if DESIGN.md is missing |
| plan | `codebase-design` for structural changes; `grilling` on the plan before approval, for work past the size gate | list the surfaces and the shape brief's decisions as plan tasks |
| execute | `tdd`; `diagnosing-bugs` for failures; `wizard` for steps only the human can do | `/impeccable [feature]` (new work) or the matching refine command (`layout`, `typeset`, `colorize`, `animate`, `bolder`, `quieter`); `mobile-native` for phone screens |
| rendezvous | `code-review`; `simplify` when code changed (skip if not installed); `security-review` when auth, money, or user data change | `/impeccable critique` and `/impeccable audit`, then `/impeccable polish`; `break-ui` when the change shows lists, names, or user-entered data |
| sync docs | `writing-for-agents` when editing AGENTS.md, skills, or wiki | same |
| any | `claude-handoff` when a session gets long (skip if not installed; `handoff` from claude-mem does the same) | same |

Use the mattpocock-skills versions of `code-review` and `prototype` when another skill or built-in has the same name.
