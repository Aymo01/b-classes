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

- Keep TanStack Start file routing and shared navigation/main/footer in the root layout to preserve route behavior and a single content landmark.
- Use a single grade provider and pure grade-to-stage resolver for stage themes; no student profile integration exists, so grade selection is session-only React state until real profile data is supplied.
- Scope all stage colors through semantic CSS tokens and reusable components to keep every stage consistent without duplicating pages.
- Do not add invented educational content or backend systems during a visual redesign; integrate actual platform data only when supplied.
