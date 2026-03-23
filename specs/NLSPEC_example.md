# NLSpec: Task Management
# Version: 1.0
# Date: 2025-01-15
# Source: specs/INTERVIEW_task-management.md

## 1. Context

### 1.1 Problem Statement
Users need a way to create, organize, and track tasks within their workspace.
Currently there is no task management capability — users rely on external tools
which fragments their workflow.

### 1.2 Prior Art
The `projects` module is the closest existing module. It provides workspace-scoped
CRUD with similar auth patterns and tenant isolation.

### 1.3 Scope
**IN scope:**
- Create, read, update, delete tasks
- Assign tasks to workspace members
- Task status lifecycle: `todo` → `in_progress` → `done`
- Filter tasks by status, assignee, due date
- Due date with optional reminder

**OUT of scope — do NOT implement:**
- Subtasks / task hierarchy
- File attachments
- Comments / activity feed
- Recurring tasks
- Kanban board view (frontend follow-up ticket)
- Email notifications (separate spec)

## 2. Architecture

### 2.1 New Files
```
src/models/task.model.[ext]
src/services/task.service.[ext]
src/controllers/task.controller.[ext]
src/dto/task.dto.[ext]
src/tests/task.test.[ext]
```

### 2.2 Modified Files
- `src/app.module.[ext]` — register TaskModule

### 2.3 Module Registration
```
// In app.module registration file, add:
import { TaskModule } from './task/task.module';
// Add TaskModule to the modules array
```

### 2.4 Dependencies
**Uses:** AuthModule (for JWT guard), DatabaseModule (for repository)
**Does NOT use:** NotificationModule, FileModule, CommentModule

## 3. Data Model

### 3.1 Entity

| Field | Type | Constraints | Default | Comment |
|-------|------|-------------|---------|---------|
| id | UUID | PK, auto-generated | — | Primary key |
| workspaceId | UUID | NOT NULL, INDEX | — | Tenant isolation field |
| title | string(255) | NOT NULL | — | Task title |
| description | text | NULLABLE | null | Optional long description |
| status | enum | NOT NULL | 'todo' | One of: todo, in_progress, done |
| assigneeId | UUID | NULLABLE, FK → users.id | null | Assigned workspace member |
| dueDate | timestamp | NULLABLE | null | Optional due date |
| priority | enum | NOT NULL | 'medium' | One of: low, medium, high, urgent |
| createdAt | timestamp | NOT NULL | now() | Auto-set on creation |
| updatedAt | timestamp | NOT NULL | now() | Auto-updated on mutation |

### 3.2 DTOs

**CreateTaskDto:**
```json
{
  "title": "string (required, 1-255 chars)",
  "description": "string (optional, max 10000 chars)",
  "status": "string (optional, one of: todo, in_progress, done — default: todo)",
  "assigneeId": "UUID (optional)",
  "dueDate": "ISO 8601 timestamp (optional)",
  "priority": "string (optional, one of: low, medium, high, urgent — default: medium)"
}
```

**UpdateTaskDto:**
All fields from CreateTaskDto, all optional (partial update).

### 3.3 Enums / Constants

```
TASK_STATUS = { TODO: 'todo', IN_PROGRESS: 'in_progress', DONE: 'done' }
TASK_PRIORITY = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', URGENT: 'urgent' }
```

## 4. API Endpoints

### 4.1 POST /tasks
- **Purpose:** Create a new task
- **Auth:** JWT required
- **Request Body:**
  ```json
  {
    "title": "Implement login page",
    "description": "Build the login page with email/password fields",
    "priority": "high",
    "assigneeId": "a1b2c3d4-...",
    "dueDate": "2025-02-01T00:00:00Z"
  }
  ```
- **Success Response (201):**
  ```json
  {
    "id": "f5e6d7c8-...",
    "workspaceId": "w1x2y3z4-...",
    "title": "Implement login page",
    "description": "Build the login page with email/password fields",
    "status": "todo",
    "priority": "high",
    "assigneeId": "a1b2c3d4-...",
    "dueDate": "2025-02-01T00:00:00Z",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
  ```
- **Error Responses:**
  | Status | Condition | Body |
  |--------|-----------|------|
  | 400 | Title missing or too long | `{ "error": "Bad Request", "message": "title must be between 1 and 255 characters" }` |
  | 400 | Invalid status value | `{ "error": "Bad Request", "message": "status must be one of: todo, in_progress, done" }` |
  | 401 | No valid JWT | `{ "error": "Unauthorized" }` |
  | 404 | assigneeId not found in workspace | `{ "error": "Not Found", "message": "Assignee not found" }` |
- **Security Notes:** workspaceId is extracted from JWT, never from request body

### 4.2 GET /tasks
- **Purpose:** List tasks in the workspace
- **Auth:** JWT required
- **Query Parameters:**
  | Param | Type | Required | Default | Validation |
  |-------|------|----------|---------|------------|
  | status | string | no | — | One of: todo, in_progress, done |
  | assigneeId | UUID | no | — | Valid UUID format |
  | priority | string | no | — | One of: low, medium, high, urgent |
  | page | number | no | 1 | Min 1 |
  | limit | number | no | 20 | Min 1, Max 100 |
- **Success Response (200):**
  ```json
  {
    "data": [ /* array of task objects */ ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
  ```
- **Security Notes:** Only returns tasks where workspaceId matches JWT

### 4.3 GET /tasks/:id
- **Purpose:** Get a single task by ID
- **Auth:** JWT required
- **Success Response (200):** Full task object (same shape as POST response)
- **Error Responses:**
  | Status | Condition | Body |
  |--------|-----------|------|
  | 401 | No valid JWT | `{ "error": "Unauthorized" }` |
  | 404 | Task not found OR belongs to different workspace | `{ "error": "Not Found" }` |
- **Security Notes:** Returns 404 (not 403) for wrong-tenant access to prevent enumeration

### 4.4 PATCH /tasks/:id
- **Purpose:** Update a task (partial update)
- **Auth:** JWT required
- **Request Body:** Any subset of CreateTaskDto fields
- **Success Response (200):** Updated task object
- **Error Responses:** Same as POST + 404 if not found
- **Security Notes:** Validates workspaceId ownership before mutation

### 4.5 DELETE /tasks/:id
- **Purpose:** Delete a task
- **Auth:** JWT required
- **Success Response (204):** No body
- **Error Responses:**
  | Status | Condition | Body |
  |--------|-----------|------|
  | 401 | No valid JWT | `{ "error": "Unauthorized" }` |
  | 404 | Task not found OR wrong workspace | `{ "error": "Not Found" }` |

## 5. Business Logic

### 5.1 Core Flow
1. User creates a task → status defaults to `todo`, workspaceId from JWT
2. User can update any field including status transitions (no restrictions on which transitions are allowed)
3. User can assign a task to any member of their workspace (validate assigneeId exists in workspace)
4. User can delete any task in their workspace
5. Listing supports filtering by status, assignee, and priority with pagination (default 20, max 100)

### 5.2 External Service Interactions
None — this module works entirely with local database.

### 5.3 Tenant Isolation
Every database query MUST include `workspaceId` in the WHERE clause.

**Correct:**
```sql
SELECT * FROM tasks WHERE id = :id AND workspace_id = :workspaceId
```

**Wrong (NEVER do this):**
```sql
SELECT * FROM tasks WHERE id = :id
```

## 6. Exemplars

### 6.1 Reference Module
The `projects` module — similar CRUD with workspace scoping.

### 6.2 What to Replicate
- Auth guard pattern from projects controller
- Workspace extraction from JWT in controller
- Repository pattern from projects repository
- Pagination helper pattern
- Test structure and mocking approach

### 6.3 What NOT to Replicate
- Projects' nested resource patterns (tasks are flat, not nested)
- Projects' archive/soft-delete pattern (tasks use hard delete)

## 7. Constraints

### 7.1 Forbidden Approaches
- Do NOT add WebSocket/real-time updates (out of scope)
- Do NOT add cascade deletes to other entities
- Do NOT import NotificationModule or FileModule

### 7.2 Error Handling
- Use the project's standard error/exception classes
- 404 for not found AND wrong-tenant (prevents enumeration)
- 400 for validation errors
- 401 for missing/invalid auth

### 7.3 Logging
- Use the project's standard logger, not console.log/print
- Log task creation and deletion at INFO level
- Log auth failures at WARN level

### 7.4 Protected Files
Do NOT modify any files listed in the deny list of `.claude/settings.json`.

## 8. Frontend Impact

### Verdict C — "Frontend not required"
- **Why not needed:** This spec covers the API only. Frontend work (task list page,
  create/edit forms, Kanban board) is tracked in a separate spec: `NLSPEC_task-ui.md`.
- **End-to-end usability confirmed:** The API can be used directly via API clients
  or integrated by the frontend team independently. All endpoints are fully functional
  without UI changes.

## 9. Acceptance Criteria

### 9.1 Functional
- [ ] Can create a task with title only (minimal)
- [ ] Can create a task with all fields
- [ ] Can list tasks with pagination
- [ ] Can filter tasks by status
- [ ] Can filter tasks by assignee
- [ ] Can update task status
- [ ] Can assign a task to a workspace member
- [ ] Can delete a task
- [ ] Returns 404 for non-existent task
- [ ] Returns 404 for task in different workspace (not 403)

### 9.2 Tenant Isolation
- [ ] Workspace A cannot see Workspace B's tasks via GET
- [ ] Workspace A cannot modify Workspace B's tasks (returns 404, not 403)
- [ ] All repository queries include workspaceId in WHERE clause

### 9.3 Structural
- [ ] Files in correct directories
- [ ] Module registered
- [ ] All endpoints use authentication
- [ ] All endpoints have API documentation
- [ ] No new dependencies
- [ ] No console.log / print statements
- [ ] No protected files modified

### 9.4 Build
- [ ] Build command passes
- [ ] Lint command passes
- [ ] Test command passes
