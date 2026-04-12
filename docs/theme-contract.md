# Theme Contract

This document defines the backend contract for tenant-scoped storefront themes.

## Goals

- Lock the JSON shape used by both frontend and backend.
- Keep theme metadata/config/publish status predictable.
- Avoid schema drift as theme features evolve.

## Data Model

### Theme metadata (`theme_metadata`)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "string",
  "slug": "string",
  "version": "string",
  "author": "string | null",
  "description": "string | null",
  "is_active": "boolean",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Theme config (`theme_config`)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "theme_id": "uuid",
  "config_json": {
    "schema_version": "1.0.0",
    "tokens": {
      "colors": {
        "primary": "#000000",
        "secondary": "#ffffff",
        "accent": "#ff5500",
        "background": "#f8f8f8",
        "text": "#111111"
      },
      "typography": {
        "font_family": "Inter",
        "heading_scale": 1.2,
        "base_size_px": 16
      },
      "spacing": {
        "unit": 8,
        "radius": 8
      }
    },
    "layout": {
      "header": {
        "sticky": true,
        "show_search": true,
        "show_account": true,
        "show_cart": true
      },
      "footer": {
        "show_newsletter": true,
        "columns": 4
      }
    },
    "content": {
      "home_hero": {
        "enabled": true,
        "title": "Welcome",
        "subtitle": "Shop now"
      }
    },
    "features": {
      "quick_buy": true,
      "wishlist": false,
      "recommendations": true
    }
  },
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Theme publish status (`theme_publish_status`)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "theme_id": "uuid",
  "status": "published | unpublished",
  "published_at": "timestamp | null",
  "unpublished_at": "timestamp | null",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## Admin API Contract

All admin requests are tenant-scoped using `x-tenant-id`.

### 1) Upload + activate theme

- **Endpoint**: `POST /admin/themes/upload-activate`
- **Request body**:

```json
{
  "name": "Spring Refresh",
  "slug": "spring-refresh",
  "version": "1.0.0",
  "author": "Design Team",
  "description": "Seasonal theme",
  "config_json": {}
}
```

- **Behavior**:
  - Creates a new theme metadata row.
  - Marks all previous tenant themes as inactive.
  - Sets the new theme as active.
  - Creates initial config and publish status (`unpublished`).

### 2) Edit theme settings

- **Endpoint**: `POST /admin/themes/settings`
- **Request body**:

```json
{
  "theme_id": "uuid (optional, defaults to active)",
  "config_json": {}
}
```

- **Behavior**:
  - Replaces theme config JSON for selected/active theme.

### 3) Publish / unpublish

- **Endpoint**: `POST /admin/themes/publish`
- **Request body**:

```json
{
  "theme_id": "uuid (optional, defaults to active)",
  "publish": true
}
```

- **Behavior**:
  - `publish: true` -> status becomes `published` and updates `published_at`.
  - `publish: false` -> status becomes `unpublished` and updates `unpublished_at`.

## Storefront API Contract

### Get active tenant theme config

- **Endpoint**: `GET /store/theme/config`
- **Headers**: `x-tenant-id: <tenant-uuid>`
- **Response**:

```json
{
  "theme": {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "Spring Refresh",
    "slug": "spring-refresh",
    "version": "1.0.0",
    "author": "Design Team",
    "description": "Seasonal theme",
    "is_active": true
  },
  "config": {},
  "publish_status": "published",
  "published_at": "2026-04-12T12:00:00.000Z"
}
```

## Versioning Rules

1. `config_json.schema_version` must be bumped for any breaking JSON contract change.
2. Additive fields are allowed in minor versions.
3. Field removals/renames require a migration plan and frontend rollout note.
4. This document is the source of truth for frontend/backend integration.
