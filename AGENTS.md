<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use computeProjectCosts for scenario totals; it applies one shared discount rate and retains matched baseline salaries for reallocation, preventing double counting across UI and exports.
- Keep Excel year and staff row coordinates as returned metadata and link formulas to those coordinates, so varying item counts and periods cannot shift references.
- Use useCalculationAgent for all calculation AI calls to attach current assumptions and exact position names consistently.
- Outbound credential emails stay in authenticated TanStack server functions and require the mail API key; this stack uses Worker server functions rather than Supabase Edge Functions.
- Run unit tests with the isolated Vitest configuration so server handlers can be tested without the framework RPC transform.
- Keep result-only cost filtering and warning/move helpers in a browser-safe presentation module; derive amounts with existing calculation functions without modifying scenario math.
- Use computeFreedTime for the informational staff-time breakdown across results, Excel and AI; keep signed computeReallocation as the sole added benefit in net totals to avoid counting financial removals twice.
- Keep result definitions in the browser-safe GLOSSARY shared by help, print and Excel comments; use GlossaryInfo for consistent keyboard, hover and touch access.
