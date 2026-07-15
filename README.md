# Postman Wrapper Backend

Static Express backend generated from the Postman collection in `postman/collection.json`.

## Structure

- `src/routes/`
  - folder-wise route files with explicit endpoints
- `src/controllers/`
  - shared wrapper controller
- `src/services/`
  - folder-wise endpoint definitions
  - shared wrapper service
- `src/client/`
  - upstream HTTP client

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Notes

- The app does not parse the Postman file at runtime anymore 
- Routes are already written into code under `src/routes`
- Postman folders are split into separate route files
- One invalid Postman item named `New Request` was skipped because it has no URL/path
- Several Postman items were duplicates of the same method and path, so they were merged into the same actual Express route and kept as comments in the route files
- Set `MONGODB_URI` to enable resource tracking. The wrapper records ForgeSphere-created resources in per-resource collections, writes audit rows to `kong_resource_histories`, and enriches Kong list responses with `forgeSphere.createdVia`, `onboardingId`, and `onboardingDetails`.
- Pass `onboardingId` via body, query, or `x-onboarding-id`. Pass actor details via `x-user-email`; tracking fields are stripped before forwarding payloads to Kong.
- MongoDB is best-effort by default, so the wrapper still starts if Mongo is temporarily unavailable. Set `MONGODB_REQUIRED=true` when startup should fail on Mongo connection errors.
