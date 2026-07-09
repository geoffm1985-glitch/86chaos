# 86 Chaos 16.0.2 Deploy Notes

## Source Package Scope

The uploaded source-of-truth ZIP only contains `src` plus a README. This updated ZIP keeps that scope and does not invent missing app infrastructure.

## Apply Steps

1. Copy the updated `src` folder into the full 86 Chaos app repository.
2. Keep the full app repository's existing `api`, `public`, Firebase rules, Vercel config, environment variables, and package metadata.
3. Update the full app repository's hosted `public/version.json` to:

```json
{
  "version": "16.0.2"
}
```

4. Run install/build/test commands from the full app repository where `package.json` and dependencies exist.
5. Deploy using the existing Vercel/Firebase workflow for the full app.

## Deployment Risk Notes

- The design upgrade is scoped to shared styling, shell chrome, drawer/menu presentation, and pre-login visuals.
- Existing route IDs, menu labels, permission gates, data hooks, Firebase config, secure fetch logic, and feature render conditions are preserved.
- The drawer visually groups existing tabs but does not add duplicate menus or move System Administrator into a new route.
- Customer logos are optional and can only appear beside the 86 Chaos logo.
- Build was not run from this ZIP because this ZIP does not contain the full app build metadata or dependencies.
