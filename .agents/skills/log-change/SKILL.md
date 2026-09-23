---
name: log-change
description: Append an entry to a prototype's CHANGELOG.md (or the root one for shared packages) for a change that is verified and pushed. Use when asked to log, record, or write up a change. Do not use for changes that haven't passed pnpm verify or haven't been pushed.
---

# Log change

1. Confirm the change passed `pnpm verify` and was pushed. You never commit or push; the user does. If it hasn't been pushed yet, say the entry comes after the push and stop.
2. If you don't know why the change was made, ask. The why is the point of the entry.
3. Run `pnpm log-change <slug>` (use `root` for shared packages). If `log-change` is not in the root `package.json`, stop and say it arrives in Stage 5 of docs/PLAN.md.
4. The entry needs: the date, the config version, one line per change with its reason, the session and turn if a playtest motivated it, and "Unverified" where it hasn't been tested with players. Example:

   ```
   ## 2026-09-20 — cards@13
   - Ember Scout cost 3 → 2. Early lane pressure was unanswerable (session a7f3, turn 6).
   ```

5. Show the user the entry as written.
