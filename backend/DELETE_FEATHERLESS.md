# Deleting Featherless before final submission

Featherless is wired in as a **testing-only** secondary provider. Fireworks is
the main provider and needs no changes. Everything Featherless-related is
tagged `FEATHERLESS (TESTING ONLY)` so you can just search for that string.

Quickest way: search the repo (case-sensitive) for:

```
FEATHERLESS (TESTING ONLY)
```

That finds every block below. Delete each one, then do the two "also update"
steps at the bottom.

## 1. `backend/agent_core.py`

- [ ] Delete the `FEATHERLESS_API_KEY` / `FEATHERLESS_MODEL` / `FEATHERLESS_URL`
      constants block (marked `=== FEATHERLESS (TESTING ONLY) === ... === END
      FEATHERLESS (TESTING ONLY) CONSTANTS ===`).
- [ ] Delete the whole `call_featherless()` function (marked with the same
      begin/end banner comments).
- [ ] In `_PROVIDERS`, delete the `("featherless", call_featherless)` line —
      leave `("fireworks", call_fireworks)` as the only entry.
- [ ] In `PROVIDER_IDS`, remove `"featherless"` from the list.
- [ ] **Do NOT delete `NOTEBOOK_RELAY_URL`** — it's still used by
      `call_amd_notebook_qwen()` / `call_amd_notebook_gemma()` for genuine
      on-GPU AMD inference. Only its *use inside* `call_featherless()` goes
      away (and that disappears automatically once you delete the function).
- [ ] Optional cleanup: in `get_provider_detail()`, the `if provider ==
      "featherless":` branch becomes dead code once "featherless" can never
      come back from `get_llm_status()` — fine to delete, harmless to leave.

## 2. `backend/main.py`

- [ ] In `_PROVIDER_LABELS`, delete the `"featherless": {...}` entry.
- [ ] In `list_providers()`'s `configured_map`, delete the `"featherless":
      bool(FEATHERLESS_API_KEY)` line.
- [ ] The `from agent_core import ... FEATHERLESS_API_KEY ...` import lines in
      `list_providers()` and `get_status()` will need `FEATHERLESS_API_KEY` /
      `FEATHERLESS_MODEL` removed from the import list (they won't exist in
      agent_core.py anymore after step 1).

## 3. `.env.example`

- [ ] Delete the block between `─── FEATHERLESS (TESTING ONLY) ───` and
      `─── END FEATHERLESS (TESTING ONLY) ───`.
- [ ] Keep `NOTEBOOK_RELAY_URL` — same reason as above.

## 4. `backend/.env` (your real, gitignored env file)

- [ ] Remove your real `FEATHERLESS_API_KEY` / `FEATHERLESS_MODEL` values (or
      just leave them — they're simply unread once the code above is gone).

## 5. `amd_compute/amd_notebook_relay_server.ipynb` (optional but recommended)

This notebook is genuinely kept in the final submission (it's what powers the
manual AMD Notebook Qwen/Gemma providers), but it also contains its own small
Featherless fallback branch (a `call_featherless()` helper + `FEATHERLESS_*`
vars in one cell, and the `else: forward to Featherless` branch inside the
`/v1/chat/completions` handler cell). Since the backend will never send it a
model outside `OLLAMA_MODELS` once Featherless is deleted, that branch just
becomes dead code — safe to leave, but for a clean judge-facing notebook:

- [ ] Delete the `FEATHERLESS_API_KEY` / `FEATHERLESS_MODEL` / `FEATHERLESS_URL`
      cell and the `call_featherless()` helper cell.
- [ ] In the server cell, delete the `else: result = call_featherless(...)`
      branch and just return an error for unrecognized models instead.

## 6. Sanity check

- [ ] `grep -ri featherless backend/agent_core.py backend/main.py .env.example`
      should return nothing except (if you kept it) references inside the
      `FEATHERLESS (TESTING ONLY)` block itself (which you're deleting anyway).
- [ ] Confirm no file or variable name anywhere still contains the word
      "featherless" — `NOTEBOOK_RELAY_URL` and
      `amd_compute/amd_notebook_relay_server.ipynb` are already clean.
- [ ] Restart the backend, hit `GET /api/status` and `GET /api/providers` —
      you should see only `fireworks`, `amd_notebook_qwen`,
      `amd_notebook_gemma` listed.
- [ ] Run one `/api/analyze/{patient_id}` call to confirm Fireworks alone
      still serves requests end-to-end.

That's it — nothing in `run_pipeline.py`, `specialists.py`,
`synthesis_agent.py`, `report_agent.py`, or the frontend references Featherless
directly, so no changes are needed there.
