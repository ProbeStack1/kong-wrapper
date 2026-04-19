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
