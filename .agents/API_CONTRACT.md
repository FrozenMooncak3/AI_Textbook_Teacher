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

### `POST /api/modules/[moduleId]/generate-questions`

Request body:

```json
{}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": 1,
        "module_id": 1,
        "kp_id": 1,
        "question_type": "worked_example",
        "question_text": "string",
        "correct_answer": "string",
        "scaffolding": "string",
        "order_index": 1
      }
    ],
    "cached": true
  }
}
```

### `POST /api/modules/[moduleId]/qa-feedback`

Request body:

```json
{
  "questionId": 1,
  "userAnswer": "string"
}
```

### `POST /api/modules/[moduleId]/generate-notes`

Request body:

```json
{}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "noteId": 1,
    "content": "string",
    "cached": true
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "responseId": 1,
    "is_correct": true,
    "score": 1,
    "feedback": "string"
  }
}
```

## Change Log

- [2026-03-28] [Codex] Added reading notes CRUD API contract for M2.
- [2026-03-28] [Codex] Added Q&A question generation API contract for M2.
- [2026-03-28] [Codex] Added Q&A instant feedback API contract for M2.
- [2026-03-28] [Codex] Added study notes generation API contract for M2.
