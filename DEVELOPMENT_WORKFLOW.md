# OrderRail Development Workflow

All future sprint developments must strictly adhere to the following sequence:

1. **Planning**: Define the scope, milestones, and required commits.
2. **Implementation**: Code changes on a dedicated feature branch.
3. **TypeScript**: Validate compilation safety using `npx tsc --noEmit`.
4. **Tests**: Run unit and integration tests using `npm run test` (Vitest).
5. **Build**: Run the production build via `npm run build` to verify bundler optimization.
6. **Manual QA**: Perform detailed manual verification on desktop and mobile viewports.
7. **Product Consistency Checklist**: Verify layout impact (taps, clutter, database impact, backward compatibility).
8. **Sprint Report**: Draft a markdown report summarizing accomplishments, before/after states, QA tests, and commit log.
9. **ChatGPT Review**: Walk through the changes to check for logic or security issues.
10. **Review Fixes**: Address any feedback raised during review.
11. **Merge**: Integrate changes into the target branch.
12. **Production Deployment**: Trigger deployment pipeline (for release milestones).
13. **Manual Production QA**: Run post-deployment tests to certify live production sanity.
14. **Next Sprint**: Proceed to the next sprint.
