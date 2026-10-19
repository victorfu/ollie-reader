# CEFR word levels

`cefrLevels.json` maps a lowercase English headword to its CEFR level
(`"A1" | "A2" | "B1" | "B2" | "C1" | "C2"`). Keys are sorted alphabetically.
The Word Practice feature uses it to label vocabulary words with a level.

```json
{ "abandon": "B1", "cloak": "C1" }
```

## Sources

| Levels | Source | Version |
| ------ | ------ | ------- |
| A1-B2 | https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv | CEFR-J 1.5 |
| C1-C2 | https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv | Octanove 1.0 |

The CSV files are downloaded when the script runs and are not committed.

## Attribution

- A1-B2: The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
- C1/C2: Octanove Vocabulary Profile (CC BY-SA 4.0)

## Licensing

- **CEFR-J Wordlist**: free to use for research and commercial purposes, provided
  the source is credited (see Attribution above). The copyright belongs to the
  TUFS Tono Laboratory.
- **Octanove Vocabulary Profile**: CC BY-SA 4.0.
- **`cefrLevels.json`**: because it contains data derived from the Octanove
  Vocabulary Profile, this file is released under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## How the file is built

For each CSV, the script reads the `headword` and `CEFR` columns, then:

- splits the headword on `/` into variants (e.g. `a.m./A.M./am/AM`);
- trims each variant, collapses runs of whitespace into one space, and lowercases it;
- skips rows whose level is not one of A1, A2, B1, B2, C1, C2;
- when the same key appears more than once, keeps the lowest level.

## Regenerate

```bash
npm run build-cefr
```

This runs `scripts/build-cefr-levels.mjs`, which downloads both CSV files and
rewrites `cefrLevels.json`. It needs network access.
