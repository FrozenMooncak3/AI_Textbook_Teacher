# API Contract

## Response Envelope

All M2+ APIs use the `handleRoute()` envelope:

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

### `GET /api/modules/[moduleId]/qa-feedback`

Response `200`:

```json
{
  "success": true,
  "data": {
    "responses": {
      "42": {
        "is_correct": true,
        "score": 0.9,
        "feedback": "string",
        "user_answer": "string"
      }
    }
  }
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

### `POST /api/modules/[moduleId]/test/generate`

Request body:

```json
{
  "retake": false
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "paper_id": 1,
    "attempt_number": 1,
    "questions": [
      {
        "id": 1,
        "kp_id": 1,
        "kp_ids": [1, 2],
        "question_type": "single_choice",
        "question_text": "string",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "order_index": 1
      }
    ],
    "cached": true
  }
}
```

Note: `correct_answer` and `explanation` are NOT returned (blind test). `options` is `null` for non-single-choice types. `cached` is `true` when returning an existing unsubmitted paper.

### `POST /api/modules/[moduleId]/test/submit`

Request body:

```json
{
  "paper_id": 1,
  "answers": [
    { "question_id": 1, "user_answer": "B" },
    { "question_id": 2, "user_answer": "详细文字回答..." }
  ]
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "paper_id": 1,
    "attempt_number": 1,
    "total_score": 35,
    "max_score": 45,
    "pass_rate": 78,
    "is_passed": false,
    "results": [
      {
        "question_id": 1,
        "question_type": "single_choice",
        "question_text": "string",
        "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
        "correct_answer": "B",
        "explanation": "string",
        "user_answer": "A",
        "is_correct": false,
        "score": 0,
        "max_score": 5,
        "feedback": "string",
        "error_type": "confusion",
        "remediation": "string"
      }
    ]
  }
}
```

Note: `pass_rate` is an integer 0-100 (percentage). `is_passed` is `true` when `pass_rate >= 80`. `error_type` is one of: `blind_spot`, `procedural`, `confusion`, `careless` (null for correct answers).

### `GET /api/modules/[moduleId]/test`

Response `200`:

```json
{
  "success": true,
  "data": {
    "learning_status": "testing",
    "in_progress_paper_id": null,
    "history": [
      {
        "paper_id": 1,
        "attempt_number": 1,
        "total_score": 35,
        "pass_rate": 78,
        "is_passed": false,
        "created_at": "datetime"
      }
    ]
  }
}
```

### `GET /api/modules/[moduleId]/mistakes`

Response `200`:

```json
{
  "success": true,
  "data": {
    "mistakes": [
      {
        "id": 1,
        "kp_id": 1,
        "kp_code": "C1.1",
        "kp_description": "string",
        "knowledge_point": "string",
        "error_type": "blind_spot",
        "source": "test",
        "remediation": "string",
        "is_resolved": false,
        "created_at": "datetime"
      }
    ]
  }
}
```

### `GET /api/review/due`

Response `200`:

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "schedule_id": 1,
        "module_id": 1,
        "module_title": "string",
        "book_id": 1,
        "book_title": "string",
        "review_round": 1,
        "due_date": "2026-04-02"
      }
    ]
  }
}
```

### `POST /api/auth/register`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "inviteCode": "BETA-001",
  "displayName": "Optional Name"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "Optional Name"
  }
}
```

Note: sets an HttpOnly session cookie on success.

### `POST /api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "Optional Name"
  }
}
```

Note: sets an HttpOnly session cookie on success.

### `POST /api/auth/logout`

Response `200`:

```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

Note: clears the session cookie.

### `GET /api/auth/me`

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "Optional Name"
  }
}
```

Response `401` when the session cookie is missing or expired.

### `POST /api/review/[scheduleId]/generate`

Request body:

```json
{}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "total_questions": 8,
    "current_index": 1,
    "question": {
      "id": 1,
      "type": "single_choice",
      "text": "string",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."]
    }
  }
}
```

Resume response when all stored questions are already answered:

```json
{
  "success": true,
  "data": {
    "total_questions": 8,
    "current_index": 8,
    "all_answered": true
  }
}
```

### `POST /api/review/[scheduleId]/respond`

Request body:

```json
{
  "question_id": 1,
  "user_answer": "string"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "is_correct": true,
    "score": 1,
    "ai_feedback": "string",
    "correct_answer": "string",
    "explanation": "string",
    "has_next": true,
    "next_question": {
      "id": 2,
      "type": "essay",
      "text": "string",
      "options": null
    }
  }
}
```

### `POST /api/review/[scheduleId]/complete`

Request body:

```json
{}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_questions": 8,
      "correct_count": 6,
      "accuracy": 0.75,
      "clusters": [
        {
          "name": "string",
          "correct": 3,
          "total": 4
        }
      ]
    },
    "next_review": {
      "round": 2,
      "due_date": "2026-04-09"
    }
  }
}
```

When review round 5 is completed and no further schedule is created, `next_review` is `null`.

### `GET /api/books/[bookId]/dashboard`

Response `200`:

```json
{
  "success": true,
  "data": {
    "book": {
      "id": 1,
      "title": "string",
      "totalModules": 10,
      "completedModules": 6
    },
    "modules": [
      {
        "id": 1,
        "title": "string",
        "orderIndex": 1,
        "learningStatus": "completed",
        "qaProgress": {
          "total": 8,
          "answered": 8
        },
        "testScore": 85,
        "testPassed": true
      }
    ],
    "reviewsDue": [
      {
        "scheduleId": 1,
        "moduleId": 1,
        "moduleTitle": "string",
        "dueDate": "2026-04-05",
        "round": 2,
        "isOverdue": false
      }
    ],
    "recentTests": [
      {
        "moduleId": 1,
        "moduleTitle": "string",
        "score": 85,
        "passed": true,
        "completedAt": "datetime"
      }
    ],
    "mistakesSummary": {
      "total": 12,
      "byType": {
        "blind_spot": 4,
        "procedural": 3,
        "confusion": 3,
        "careless": 2
      }
    }
  }
}
```

### `GET /api/books/[bookId]/mistakes`

Query params:

- `module=1` optional module filter
- `errorType=blind_spot` optional error type filter
- `source=test` optional source filter

Response `200`:

```json
{
  "success": true,
  "data": {
    "mistakes": [
      {
        "id": 1,
        "moduleId": 1,
        "moduleTitle": "string",
        "questionText": "string",
        "userAnswer": "string",
        "correctAnswer": "string",
        "errorType": "blind_spot",
        "remediation": "string",
        "source": "test",
        "kpTitle": "string",
        "createdAt": "datetime"
      }
    ],
    "summary": {
      "total": 12,
      "byType": {
        "blind_spot": 4,
        "procedural": 3,
        "confusion": 3,
        "careless": 2
      },
      "byModule": [
        {
          "moduleId": 1,
          "moduleTitle": "string",
          "count": 5
        }
      ]
    }
  }
}
```

## Change Log

- [2026-03-28] [Codex] Added reading notes CRUD API contract for M2.
- [2026-03-28] [Codex] Added Q&A question generation API contract for M2.
- [2026-03-28] [Codex] Added Q&A instant feedback API contract for M2.
- [2026-03-28] [Codex] Added study notes generation API contract for M2.
- [2026-03-29] [Codex] Added GET contract for `/api/modules/[moduleId]/qa-feedback` so frontend can resume answered questions.
- [2026-03-31] [Claude] Added M3 test generate, test submit, test status, and mistakes API contracts.
- [2026-04-02] [Codex] Added M4 review API contracts for due, generate, respond, and complete endpoints.
- [2026-04-03] [Codex] Added book-level dashboard and mistakes API contracts, and updated review respond response fields.
- [2026-04-06] [Codex] Added auth register/login/logout/me API contracts for M6 invite-code authentication.
