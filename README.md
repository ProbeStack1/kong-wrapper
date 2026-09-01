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

## Dynamic Konnect PAT

Verify the Admin URL and PAT entered on the Kong profile screen:

```http
POST /config/konnect/verify
Content-Type: application/json

{
  "adminUrl": "https://us.api.konghq.com",
  "patToken": "<konnect-personal-access-token>"
}
```

A successful request stores the PAT in MongoDB and returns `valid: true`,
`stored: true`, a generated `profileId`, and the normalized Admin URL without
returning the token. Pass the returned ID as the `profileId` query parameter on
every Kong management API call.

The backend loads the PAT and Admin URL belonging to that profile from MongoDB.
To update an existing profile, include its `profileId` in the verification
request body. Wrapper-only `profileId` and `region` query parameters are removed
before forwarding to Konnect. Management APIs always use the PAT loaded by
profile ID.

The configuration UI flow is:

1. Load profile options from `GET /config/konnect/profiles`.
2. Select a profile and region.
3. Load control planes using
   `GET /v2/control-planes?region=us&profileId=<profileId>`.
4. Put the selected control-plane ID in the existing management API URL, and
   send the same profile ID and region with every request:

```http
GET /v2/control-planes/<controlPlaneId>/core-entities/services?region=us&profileId=<profileId>
```

This temporary implementation stores each profile PAT as plain text in the
`kong_config` collection. Replace it with application-level encryption or a
secret manager before treating this as a long-term production credential store.

Bundle generation requires `profileId` and `control_plane_name`. It loads the
profile PAT from MongoDB and writes the selected control-plane name and PAT into
the generated GitHub Actions workflow:

```http
POST /kong-bundles
Content-Type: application/json

{
  "profileId": "<profileId>",
  "control_plane_name": "my-control-plane",
  "services": [
    {
      "name": "example-service",
      "url": "https://example.com"
    }
  ]
}
```

The generated ZIP therefore contains a live credential. Treat it as secret
material and do not commit or share the generated workflow.

## Notes

- The app does not parse the Postman file at runtime anymore 
- Routes are already written into code under `src/routes`
- Postman folders are split into separate route files
- One invalid Postman item named `New Request` was skipped because it has no URL/path
- Several Postman items were duplicates of the same method and path, so they were merged into the same actual Express route and kept as comments in the route files
- Set `MONGODB_URI` to enable resource tracking. The wrapper records ForgeSphere-created resources in per-resource collections, writes audit rows to `kong_resource_histories`, and enriches Kong list responses with `forgeSphere.createdVia`, `onboardingId`, and `onboardingDetails`.
- Pass `onboardingId` via body, query, or `x-onboarding-id`. Pass actor details via `x-user-email`; tracking fields are stripped before forwarding payloads to Kong.
- MongoDB is best-effort by default, so the wrapper still starts if Mongo is temporarily unavailable. Set `MONGODB_REQUIRED=true` when startup should fail on Mongo connection errors.
