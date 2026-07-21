# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (hot-reload via nodemon + tsx)
npm run dev

# Production build
npm run build      # tsc → dist/
npm start          # node dist/index.js

# Database migrations
npm run migrate:roles           # seed/migrate role system
npm run migrate:project-links   # backfill project ↔ quotation/invoice links
```

No test runner is configured. TypeScript type-checking is the primary correctness signal:
```bash
npx tsc --noEmit
```

## Architecture

**SIRE Tech API** — B2B tech services platform. Core business flow:

```
QuotationRequest (public RFQ) → Project → Quotation → Invoice → Payment
```

### Entry Point
`src/index.ts` — sets up Express, MongoDB, Socket.io, CORS whitelist, and mounts all routes at `/api/<resource>`. The `io` instance and `socketConnections` Map are stored on the Express app via `app.set()` and retrieved in controllers via `req.app.get('io')`.

### Layer Conventions

| Layer | Path | Notes |
|-------|------|-------|
| Models | `src/models/` | Mongoose schemas; auto-generate numbered IDs (e.g. `QT-2025-0001`) via pre-save hooks |
| Controllers | `src/controllers/` | One file per resource; `async (req, res, next)` functions; errors passed to `next(errorHandler(status, message))` |
| Routes | `src/routes/` | Thin — only wires middleware + controller functions |
| Types | `src/types/index.ts` | All shared interfaces live here; `req.user` is typed as `IUserResponse` |
| Services | `src/services/external/` | SendGrid email, M-Pesa (Daraja), Paystack, Africa's Talking SMS |
| Services | `src/services/internal/` | `notificationService`, `paymentService` |
| Utils | `src/utils/` | `generatePDF.ts` (PDFKit), `pdfUpload.ts` (Cloudinary), `notificationHelper.ts` |

### Auth & Authorization
- `authenticateToken` — verifies JWT Bearer token, attaches `req.user` with populated `roleNames[]`
- `authorizeRoles(['role_name'])` — role gate; roles: `super_admin`, `finance`, `project_manager`, `client`
- `optionalAuth` — attaches user if token present, never rejects; used for public endpoints that enrich response when logged in
- Public endpoints (no auth): contact form, quotation request, public testimonials

### Key Patterns

**Error handling** — always use `next(errorHandler(statusCode, message))`, never `res.json` for errors. Global error handler in `src/index.ts` returns `{ success: false, message }`.

**PDF generation** — `generatePDF.ts` builds a PDFKit buffer → `pdfUpload.ts` uploads to Cloudinary → URL stored on the document. Called automatically on quotation/invoice create and update.

**Real-time notifications** — after any significant action, call `createInAppNotification()` from `src/utils/notificationHelper.ts`, then emit via `req.app.get('io')`.

**Auto-numbering** — all primary documents (Project, Quotation, Invoice, Payment) use a pre-save hook that counts existing documents for the year and zero-pads to 4 digits.

**Pagination** — uses `mongoose-paginate-v2`; controllers accept `page` and `limit` query params.

### Mongo Models Quick Reference

| Model | Key relations |
|-------|--------------|
| `User` | has `roles[]` → Role |
| `Project` | has `client` → User, `quotation` → Quotation, `invoice` → Invoice, `services[]` → Service |
| `Quotation` | has `project` → Project, `client` → User (inherited from project) |
| `Invoice` | has `client` → User, `quotation?` → Quotation |
| `Payment` | has `invoice` → Invoice, `client` → User |
| `Notification` | has `recipient` → User; supports `actions[]` for interactive in-app buttons |

### Environment Variables Required
`MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `CLOUDINARY_*`, `SENDGRID_API_KEY`, `MPESA_*`, `PAYSTACK_SECRET_KEY`, `AFRICASTALKING_*`, `PORT`, `NODE_ENV`

### API Docs
Swagger UI available at `/api/docs` when the server is running.
