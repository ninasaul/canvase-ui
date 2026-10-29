# @canvase/generation-params

Model-aware adapters for image and video generation parameters.

## Public API

| Entry | Responsibility |
| --- | --- |
| `@canvase/generation-params` | Barrel export |
| `.../model-families` | Detect image/video family from model id/vendor |
| `.../image` | Image profile, sanitize, request body |
| `.../video` | Video profile, sanitize, request body |

### Typical flow

1. `resolveImageFamily` / `resolveVideoFamily` (or go straight to profile)
2. `getImageCapabilityProfile` / `getVideoCapabilityProfile` → UI visibility
3. `sanitizeImageParams` / `sanitizeVideoParams` → clamp to model limits
4. `buildImageRequestBody` / `buildVideoRequestBody` → upstream payload

UI composers and i18n labels stay in the app. This package is pure TypeScript.
