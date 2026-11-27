# Partner ID import

With a lookup provider configured, open a runner's **Save & load** dropdown and select **Import Partner ID**. Enter the nine-digit Global practice code. The build is applied to that runner after validation. **Export JSON** saves the same build with its ten aptitudes and supplied skill levels.

Set the GitHub Actions repository variable `PARTNER_LOOKUP_URL` to the HTTPS endpoint of a provider that returns full trained builds. For a local build, set the environment variable of the same name before running `scripts/prepare.py`. The menu item appears when the URL is configured.

The browser sends a credential-free `GET` request with `partner_id` as a query parameter. Cross-origin providers must allow the deployed site via CORS. A successful JSON response has `partner_id` as the original nine-digit string and `veteran` as the trained character record. The record needs `card_id`, `rarity`, `running_style`, `speed`, `stamina`, `power`, `guts`, `wiz`, the ten numeric `proper_*` aptitudes, and `skill_array` entries with numeric `skill_id` and `level` where available. The native unique skill must include its level. Use HTTP `404` or `410` for missing or expired codes.

The importer uses the active course's distance and surface when available, and the veteran's recorded running style. Mood and popularity use the normal simulator defaults. The build stays in the editor if lookup or validation fails.

GitHub Pages serves the editor. A provider that resolves the code to a complete trained veteran is still required. A lineage-only response has insufficient data for simulation.
