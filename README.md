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

## Monitoring and analytics

Konnect exposes proxied requests through `POST /v2/api-requests` and publishes no
aggregate endpoint, so the wrapper pulls raw records and rolls them up in
process. Every route below takes the same `profileId` and `region` as the rest of
the management API.

| Endpoint | Purpose |
| --- | --- |
| `POST /analytics/requests` | Raw proxied requests, paged, with bare ids added |
| `GET`/`POST` `/analytics/summary` | Totals, error rate, latency percentiles, top entities, time series |
| `GET /analytics/services/:gateway_service_id` | The same roll-up scoped to one gateway service |
| `GET /analytics/routes/:route_id` | The same roll-up scoped to one route |
| `GET /analytics/health/:control_plane_id` | Data plane node status and config-sync state |

```http
GET /analytics/summary?controlPlaneId=<cpId>&region=us&profileId=<profileId>&timeRange=1H
```

Options, on the query string or in a JSON body:

- `timeRange` — `15M`, `1H`, `6H`, `12H`, `24H` or `7D`. Longer windows need
  `start` and `end` as ISO 8601 timestamps, which switches Konnect to an
  absolute range.
- `serviceId`, `routeId`, `consumerId`, `statusCode`, `httpMethod` — scope the
  roll-up. Entity ids are the bare Kong ids.
- `filters` — passed to Konnect as `[{ field, operator, value }]` for anything
  the shortcuts do not cover.
- `excludeUnmatched` — defaults to `true`, which drops requests that matched no
  route. Internet scanner traffic 404s that way and otherwise shows up as a
  permanent error rate.
- `maxRecords` (default 5000, max 20000), `pageSize` (max 1000) and `topN`
  (default 10) bound the scan. `meta.truncated` says whether the cap was hit.

Three Konnect behaviours are worth knowing before reading the numbers:

- **Analytics ids are composites.** Konnect returns `route`, `gateway_service`,
  `consumer` and `data_plane_node` as `{control_plane_id}:{entity_id}`, while the
  config API returns bare ids. Filtering by a bare id matches nothing and does
  not error. The wrapper composes ids on the way in and splits them on the way
  out, so callers only handle bare ids.
- **The status field has two different names.** You filter on `status_code`, but
  a returned record carries the value in `response_http_status`, as a string.
  Reading `status_code` off a record finds nothing, and since a missing status is
  simply not counted, the error rate reads 0% rather than failing. Both names are
  handled.
- **Retention is 14 days**, and an older window returns an empty result set
  rather than an error. The wrapper rejects it with a 400 instead.
- **Ingestion lags roughly 50 seconds.** An empty 15M window does not mean the
  gateway is idle.

Set `ANALYTICS_TIMEOUT_MS` (default 30000) rather than `REQUEST_TIMEOUT_MS` for
these routes; a multi-page roll-up will not finish inside the 10 second default.

## Notes

- The app does not parse the Postman file at runtime anymore 
- Routes are already written into code under `src/routes`
- Postman folders are split into separate route files
- One invalid Postman item named `New Request` was skipped because it has no URL/path
- Several Postman items were duplicates of the same method and path, so they were merged into the same actual Express route and kept as comments in the route files
- Set `MONGODB_URI` to enable resource tracking. The wrapper records ForgeSphere-created resources in per-resource collections, writes audit rows to `kong_resource_histories`, and enriches Kong list responses with `forgeSphere.createdVia`, `onboardingId`, and `onboardingDetails`.
- Pass `onboardingId` via body, query, or `x-onboarding-id`. Pass actor details via `x-user-email`; tracking fields are stripped before forwarding payloads to Kong.
- MongoDB is best-effort by default, so the wrapper still starts if Mongo is temporarily unavailable. Set `MONGODB_REQUIRED=true` when startup should fail on Mongo connection errors.
