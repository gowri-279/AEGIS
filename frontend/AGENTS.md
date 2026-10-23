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

## AEGIS architecture
- Canonical data (src/data/types.ts, mockCanonicalResponse.ts) is consumed as-is; the UI never computes feasibility, ranking, reliability or physics — those belong to the future FastAPI backend.
- Visual positions/dimensions live only in src/data/networkLayout.ts, kept separate from canonical data.
- All data access goes through src/services/api.ts so mocks can be swapped for backend calls without touching UI.
- The 3D network (src/components/aegis/NetworkScene.tsx) is the primary interface; every mode overlays panels on the same scene.
