# Auto-pairing

CSV Align includes a conservative **auto-pair** helper for comparison columns.

## What it does

After you select the same number of key columns in **File A** and **File B**, the app can automatically build the comparison-column order for you when it finds reliable additional matches.

When a generated order is available, it:

- keeps the selected key pair(s) first
- adds only the remaining **confident** one-to-one matches
- respects either **File A** order or **File B** order, depending on which auto-pair button you choose

## How matches are chosen

Auto-pairing reuses the existing mapping suggestion workflow and stays intentionally conservative:

1. It starts from the current header/mapping suggestions.
2. It can use loaded CSV values as extra evidence, so it can still find good matches when headers differ.
3. It keeps only confident matches:
   - exact matches, or
   - strong fuzzy matches that clear the app's confidence threshold
4. It excludes columns already used by the selected key pairs.
5. It excludes duplicate/reused pairings so the result stays one-to-one.

## Why some columns stay unmatched

Auto-pairing is designed to avoid misleading guesses.

It may leave columns unmatched when:

- the confidence is too weak
- multiple columns compete for the same target column
- the data is too low-information to justify a reliable pairing

In those cases, the app leaves the current comparison selection unchanged and you can finish the selection manually.

## Practical workflow

1. Load both CSV files.
2. Select matching key columns in File A and File B.
3. Choose **Auto-pair from File A** or **Auto-pair from File B**.
4. Review the proposed comparison order.
5. Adjust any remaining unmatched columns manually if needed.

This keeps auto-pairing helpful without changing the comparison logic itself.
