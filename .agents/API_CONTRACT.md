# API Contract

## Response Envelope

New M2 APIs use the `handleRoute()` envelope:

```json
{
  "success": true,
  "data": {}
}
```

Error responses follow:

```json
{
  "success": false,
  "error": "Message",
  "code": "ERROR_CODE"
}
```

## Endpoints

### `GET /api/modules/[moduleId]/reading-notes`

Response `200`:

```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "id": 1,
        "book_id": 1,
        "module_id": 1,
        "page_number": 12,
        "content": "string",
        "created_at": "datetime"
      }
    ]
  }
}
```

### `POST /api/modules/[moduleId]/reading-notes`

Request body:

```json
{
  "content": "string",
  "page_number": 12
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": 1
  }
}
```

### `DELETE /api/modules/[moduleId]/reading-notes?noteId=1`

Response `200`:

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

## Change Log

- [2026-03-28] [Codex] Added reading notes CRUD API contract for M2.
