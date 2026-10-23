# FinSight — Test Run Record

**Project:** FinSight — Intelligent Personal Finance Manager  
**Verification date:** 23 October 2026  
**Environment:** Local macOS development environment

## Automated Checks

| Check | Result | Evidence / notes |
|---|---|---|
| Django system check | **Passed** | `python backend/manage.py check` — no issues reported. |
| Database migrations | **Applied** | `accounts`: `0001_initial`, `0002_add_is_email_verified`; `expenses`: migrations through `0004_increase_amount_max_digits` were marked applied. |
| Backend tests | **Passed** | `python backend/manage.py test accounts expenses` — 31 tests passed. |
| Frontend production build | **Passed** | `npm run build` completed successfully with Vite. |

### Build warnings

The production build completed, but Vite reported that Browserslist data was outdated and that the minified JavaScript bundle exceeded 500 kB. These were warnings, not build failures, and can be reviewed as future optimisation work.

## Manual Checks Reported

| Scenario | Result | Notes |
|---|---|---|
| Large expense with income substantially lower than expenses | **Passed** | The user confirmed that the dashboard remained functional after the fix. |
| Future-dated transaction in the current month | **Passed** | The user confirmed that it did not affect current-period actual totals unexpectedly. |
| Transaction dated in a future year | **Passed** | The user confirmed that future-dated data did not disturb current-period totals. |
| Monthly budget editing after clearing the existing value | **Failed / unresolved** | The input still exhibits a validation problem. Do not treat this defect as fixed. |
| Email verification end-to-end | **Failed / unresolved** | The user reported that email verification was not working during manual testing. Real SMTP delivery has not been verified. |

Other manual checks, including profile persistence and appearance settings, should be repeated if they are important to the final demonstration; this record does not claim unreported outcomes.

## Commands Used

```bash
python backend/manage.py check
python backend/manage.py showmigrations accounts expenses
python backend/manage.py test accounts expenses
npm run build
```

## Conclusion

The automated backend checks and frontend production build passed in the recorded local environment. The large-expense and future-date scenarios passed manual testing. Monthly budget editing and end-to-end email verification remain unresolved and should be disclosed as known limitations until fixed and retested.
