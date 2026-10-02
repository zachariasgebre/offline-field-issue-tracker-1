# Offline Field Issue Tracker

A full-stack web application designed for field workers to log infrastructure issues offline (water points, damaged equipment, service interruptions, etc.) and seamlessly synchronize them with backend servers upon connectivity restoration. Includes a coordinator review workflow and full audit tracking.



## Technical Stack & Architecture

- **Frontend:** React (Vite), Dexie.js (IndexedDB wrapper for local persistent storage), Axios, Custom Online/Offline Event Hooks.
- **Backend:** Node.js, Express.js, Prisma ORM.
- **Database:** PostgreSQL.
- **Testing:** Jest, Supertest (Integration & API testing).



                  +-----------------------------------+
                  |     React + Vite Frontend         |
                  |  - Local Storage (IndexedDB/Dexie)|
                  |  - Sync Engine + Network Listener |
                  +-----------------+-----------------+
                                    |
                          REST API / JSON
                          (Client UUIDs)
                                    |
                  +-----------------+-----------------+
                  |    Node.js + Express Backend      |
                  |  - Idempotent Sync Endpoint       |
                  |  - State Machine Enforcement      |
                  |  - Audit History Logger           |
                  +-----------------+-----------------+
                                    |
                          Prisma ORM / SQL
                                    |
                  +-----------------+-----------------+
                  |       PostgreSQL Database         |
                  +-----------------------------------+




## Setup & Run Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL server running locally or via Docker



### 1. Backend Setup

1. Navigate to the `server` directory:
   ```bash
   cd server



2. Install backend dependencies:
```bash
npm install




3. Create a `.env` file in the `server/` directory:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/field_tracker_db?schema=public"
PORT=5000
NODE_ENV=development




*(Adjust username, password, and port to match your local PostgreSQL configuration).*
4. Run Prisma database migrations:
```bash
npx prisma migrate dev --name init




5. Start the backend development server:
```bash
npm run dev




*The server runs on `http://localhost:5000`.*



### 2. Frontend Setup

1. Open a new terminal tab/window and navigate to the `client` directory:
```bash
cd client




2. Install frontend dependencies:
```bash
npm install




3. Start the Vite React app:
```bash
npm run dev




*The client app runs on `http://localhost:5173`.*



### 3. Running Automated Tests

To execute the backend integration test suite (covering batch synchronization, idempotency, duplicate prevention, and state transitions):

```bash
cd server
npm test




## Synchronization Strategy & Design Decisions

### 1. Idempotency & Interrupted Synchronization

* **Client-Generated UUIDs:** Every report created locally receives a UUID (`clientId`) before saving to IndexedDB.
* **Server Upsert Logic:** The sync endpoint (`POST /api/reports/sync`) receives a batch of offline reports and uses client UUIDs to check for existing records.
* **Duplicate Mitigation:** If a network interruption occurs midway through sync and the client retries, existing records matching `clientId` return `SYNCED_EXISTING` without creating duplicates or raising unique constraint errors.

### 2. Offline Persistence

* Reports are persisted locally using **IndexedDB (via Dexie.js)**.
* Refreshing, closing, or reopening the browser does not wipe un-synchronized data.
* Reports maintain local state flags (`PENDING`, `SYNCED`, `FAILED`) to provide clear visual feedback to field workers.

### 3. Status Workflow & State Machine

Valid transitions are strictly enforced on the server to preserve domain integrity:

* `Draft` $\rightarrow$ `Submitted`
* `Submitted` $\rightarrow$ `Assigned` | `Rejected`
* `Assigned` $\rightarrow$ `In Progress` | `Rejected`
* `In Progress` $\rightarrow$ `Resolved` | `Rejected`
* `Resolved` $\rightarrow$ `Submitted` *(Reopened)*
* `Rejected` $\rightarrow$ `Submitted` *(Reopened)*

Attempting an invalid transition (e.g., direct jump from `Submitted` to `Resolved`) yields an **HTTP 422 Unprocessable Entity** response explaining allowed transitions.

### 4. Audit History

All significant events—creation, synchronizations, and coordinator status changes—are stored in an immutable `AuditHistory` log table attached to the parent issue report.



## Manual QA Checklist

* [ ] **Offline Creation:** Disconnect network (or use Chrome DevTools Network $\rightarrow$ *Offline*). Create a report. Verify it saves locally with a `PENDING` badge.
* [ ] **Persistence:** Refresh the page while still offline. Verify the unsynced report persists.
* [ ] **Automatic Sync:** Toggle network back to *Online*. Verify sync runs automatically, badges change to `SYNCED`, and database records are populated.
* [ ] **Duplicate Prevention:** Trigger sync manually twice for the same report. Verify no duplicate database records are created.
* [ ] **State Machine Constraints:** Attempt to transition a report status illegally via API or UI (e.g., `Submitted` to `Resolved`). Verify HTTP `422` error is returned.



## Known Limitations & Future Improvements

* **Conflict Resolution:** Current conflict policy defaults to Last-Write-Wins (LWW). A multi-user field environment would benefit from visual conflict resolution UI for overlapping coordinator and field edits.
* **Media Attachments:** In field infrastructure tracking, photo attachments are valuable. Future work could integrate compressed image storage in IndexedDB (as Blobs) and multipart batch sync.
* **Background Sync API:** Utilizing Service Workers with the Web Background Sync API would allow synchronization to run even if the browser tab is closed right as connectivity returns.



## Approximate Time Spent

**Total Time:** ~5.5 Hours

* Domain modeling & setup: 0.5 hours
* Backend API & State machine: 1.5 hours
* Frontend IndexedDB & Sync Engine: 2.0 hours
* Automated testing & verification: 1.0 hour
* Documentation & QA: 0.5 hours



## AI & Development Tool Disclosure

* **Tools Used:** ChatGPT (GPT-4o) / Claude.
* **Usage Scope:**
* Generating initial Prisma schema constraints and Express route boilerplates.
* Formulating Jest integration tests for state machine transition verification.


* **Code Acceptance & Verification:**
* Modified AI-suggested state machine structure to support issue re-opening logic (`Resolved`/`Rejected` $\rightarrow$ `Submitted`).
* Added explicit client UUID upsert behavior to ensure true endpoint idempotency.
* Manually verified offline event listeners and network throttling behavior using Chrome DevTools.

