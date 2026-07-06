# QA Checklist: 13.1.35 Voice Recipe Opening

## Setup

- Deploy the ZIP to Vercel Preview.
- Log in with an account that can access Recipe Book.
- Confirm Recipe Book contains at least one known recipe, such as Beer Cheese, Chili, or Beer Dip.

## Voice / Typed Command Tests

- Open the voice dock and say or type: `open beer cheese recipe`.
  - Expected: Recipe Book opens and the Beer Cheese spec opens directly.

- Say or type: `show me chili recipe`.
  - Expected: Recipe Book opens and the Chili spec opens directly.

- Say or type: `what is the recipe for beer dip`.
  - Expected: Recipe Book opens and the Beer Dip spec opens directly.

- Add a new test recipe, then say or type: `open [new recipe name] recipe`.
  - Expected: The newly added recipe opens without any code change or new command phrase.

- Say or type a recipe name that does not exist.
  - Expected: Recipe Book opens with the search phrase filled in and no data is modified.

## Permission Tests

- Log in as a user who does not have Recipe Book access.
  - Expected: Voice command is blocked by normal permission checks.

## Regression Tests

- Say `open recipe book`.
  - Expected: Recipe Book opens normally without targeting a specific recipe.

- Say `86 ranch`.
  - Expected: An 86 alert is sent and inventory is not edited.

- Say `prep 2 pans tomatoes`.
  - Expected: Prep task is created as before.
