# Schema Markup Generator - Implementation Plan

## Overview

Build a Schema.org structured data generator that creates JSON-LD markup for various schema types. The tool will follow the existing two-column layout pattern (form + live preview) used throughout the application.

---

## Phase 1: Foundation & Data Models

### 1.1 Create Schema Type Definitions

**File:** `src/types/schema-markup.ts`

Define TypeScript interfaces for:
- Supported schema types enum
- Form data structures per schema type
- Generated output structure
- Validation rules

```typescript
// Schema types to support (prioritized)
export enum SchemaType {
  Organization = 'Organization',
  LocalBusiness = 'LocalBusiness',
  Product = 'Product',
  Article = 'Article',
  FAQPage = 'FAQPage',
  HowTo = 'HowTo',
  Event = 'Event',
  Person = 'Person',
  Recipe = 'Recipe',
  Review = 'Review',
  BreadcrumbList = 'BreadcrumbList',
  WebSite = 'WebSite'
}

// Property definition for form generation
interface SchemaProperty {
  name: string
  label: string
  type: 'text' | 'url' | 'date' | 'number' | 'textarea' | 'select' | 'array' | 'object'
  required: boolean
  placeholder?: string
  description?: string
  options?: { value: string; label: string }[]
  nestedType?: SchemaType  // For nested objects like author: Person
  arrayItemType?: 'text' | 'url' | 'object'
}

// Template for each schema type
interface SchemaTemplate {
  type: SchemaType
  label: string
  description: string
  icon: string  // Lucide icon name
  properties: SchemaProperty[]
}
```

### 1.2 Create Schema Templates Configuration

**File:** `src/lib/schema-templates.ts`

Define templates for each supported schema type with:
- Required fields (per Google's requirements)
- Optional fields (commonly used)
- Validation rules
- Nested object handling

**Priority Schema Types (MVP):**
1. **Organization** - Company info, logo, contact
2. **LocalBusiness** - Physical business with address, hours
3. **Product** - E-commerce products with offers
4. **Article** - Blog posts, news articles
5. **FAQPage** - FAQ sections
6. **BreadcrumbList** - Navigation breadcrumbs

---

## Phase 2: UI Components

### 2.1 Create Schema Type Selector

**File:** `src/components/schema/schema-type-selector.tsx`

- Grid/tile layout for schema type selection
- Icon + label for each type
- Brief description on hover/focus
- Visual indicator for selected type

### 2.2 Create Dynamic Form Builder

**File:** `src/components/schema/schema-form.tsx`

Features:
- Renders form fields based on selected schema template
- Handles nested objects (e.g., author as Person)
- Supports repeatable fields (e.g., multiple FAQ items)
- Real-time validation with error messages
- Required field indicators (*)
- Collapsible optional field sections

### 2.3 Create Repeatable Field Group Component

**File:** `src/components/schema/repeatable-field.tsx`

For array fields like:
- FAQ question/answer pairs
- Multiple images
- Multiple offers
- HowTo steps

Features:
- Add/remove items
- Reorder items (optional)
- Minimum/maximum item limits

### 2.4 Create JSON-LD Preview Component

**File:** `src/components/schema/json-ld-preview.tsx`

Features:
- Syntax-highlighted JSON display
- Pretty-printed (2-space indentation)
- Line numbers
- Copy button with feedback
- Download as .json option
- "Test in Google" button (opens Rich Results Test)

### 2.5 Create Schema Validation Display

**File:** `src/components/schema/validation-display.tsx`

Shows:
- ✅ Required fields status
- ⚠️ Recommended fields missing
- ❌ Validation errors
- Tips for improvement

---

## Phase 3: Core Logic

### 3.1 Create JSON-LD Generator Utility

**File:** `src/lib/schema-generator.ts`

Functions:
```typescript
// Generate JSON-LD from form data
generateJsonLd(schemaType: SchemaType, formData: Record<string, any>): object

// Clean empty fields
cleanEmptyFields(obj: object): object

// Format output
formatJsonLd(schema: object): string

// Validate against requirements
validateSchema(schemaType: SchemaType, formData: Record<string, any>): ValidationResult
```

### 3.2 Create Validation Logic

**File:** `src/lib/schema-validation.ts`

Validations:
- Required fields present
- URL format validation
- Date format (ISO-8601)
- Image URL accessibility (optional)
- Nested object completeness

### 3.3 State Management Hook

**File:** `src/hooks/use-schema-form.ts`

Custom hook managing:
- Form state per schema type
- Validation state
- Generated output
- Copy status
- Reset functionality

---

## Phase 4: Main Page Implementation

### 4.1 Create Schema Generator Page

**File:** `src/app/(dashboard)/seo/schema/page.tsx`

**Layout (Two-Column):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Schema Markup Generator                                         │
│  Generate structured data for rich search results                │
├────────────────────────────────┬────────────────────────────────┤
│  LEFT COLUMN (Input)           │  RIGHT COLUMN (Output)          │
│                                │                                 │
│  ┌──────────────────────────┐  │  ┌──────────────────────────┐  │
│  │ Select Schema Type       │  │  │ JSON-LD Output           │  │
│  │ [Organization ▼]         │  │  │                          │  │
│  └──────────────────────────┘  │  │  {                        │  │
│                                │  │    "@context": "...",     │  │
│  ┌──────────────────────────┐  │  │    "@type": "...",        │  │
│  │ Required Fields          │  │  │    "name": "...",         │  │
│  │ ────────────────         │  │  │    ...                    │  │
│  │ Name *          [      ] │  │  │  }                        │  │
│  │ URL *           [      ] │  │  │                          │  │
│  │ Logo URL *      [      ] │  │  │  [Copy JSON] [Download]  │  │
│  └──────────────────────────┘  │  │  [Test in Google]        │  │
│                                │  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │                                │
│  │ ▼ Optional Fields        │  │  ┌──────────────────────────┐  │
│  │   Description   [      ] │  │  │ Validation Status        │  │
│  │   Phone         [      ] │  │  │ ✅ All required fields   │  │
│  │   ...                    │  │  │ ⚠️ Add description       │  │
│  └──────────────────────────┘  │  └──────────────────────────┘  │
│                                │                                 │
│  [Reset Form]                  │  ┌──────────────────────────┐  │
│                                │  │ HTML Snippet              │  │
│                                │  │ <script type="...">      │  │
│                                │  │   {...}                   │  │
│                                │  │ </script>                 │  │
│                                │  │                          │  │
│                                │  │ [Copy HTML]              │  │
│                                │  └──────────────────────────┘  │
└────────────────────────────────┴────────────────────────────────┘
```

### 4.2 Update SEO Hub Navigation

**File:** `src/app/(dashboard)/seo/page.tsx`

Add new card for Schema Markup Generator:
```typescript
{
  title: 'Schema Markup',
  description: 'Genereer structured data voor rich snippets',
  href: '/seo/schema',
  icon: Code2  // or Braces
}
```

---

## Phase 5: Schema Type Templates (Detail)

### 5.1 Organization Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Required",
  "url": "Required",
  "logo": "Required",
  "description": "Optional",
  "email": "Optional",
  "telephone": "Optional",
  "address": { "@type": "PostalAddress", ... },
  "sameAs": ["social URLs..."]
}
```

**Form Fields:**
- Organization Name * (text)
- Website URL * (url)
- Logo URL * (url)
- Description (textarea)
- Email (text)
- Phone (text)
- Street Address (text)
- City (text)
- Postal Code (text)
- Country (select)
- Social Media URLs (repeatable url)

### 5.2 LocalBusiness Schema

Extends Organization with:
- priceRange
- openingHoursSpecification (repeatable)
- geo coordinates
- hasMap

### 5.3 Product Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Required",
  "image": "Required",
  "description": "Required",
  "sku": "Optional",
  "brand": { "@type": "Brand", "name": "..." },
  "offers": {
    "@type": "Offer",
    "price": "Required",
    "priceCurrency": "Required",
    "availability": "Required",
    "url": "Optional"
  },
  "aggregateRating": { ... }
}
```

### 5.4 Article Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Required",
  "image": "Required",
  "datePublished": "Required",
  "dateModified": "Optional",
  "author": { "@type": "Person", "name": "..." },
  "publisher": { "@type": "Organization", ... }
}
```

### 5.5 FAQPage Schema

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text"
      }
    }
  ]
}
```

**Form Fields:**
- FAQ Items (repeatable group)
  - Question * (text)
  - Answer * (textarea)

### 5.6 BreadcrumbList Schema

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://..."
    }
  ]
}
```

---

## Phase 6: Testing & Validation

### 6.1 Integration with Google Rich Results Test

- Generate test URL with JSON-LD
- Open in new tab with prefilled data
- URL: `https://search.google.com/test/rich-results`

### 6.2 Client-Side Validation

- Real-time validation as user types
- Clear error messages in Dutch
- Visual feedback (green checkmarks, red warnings)

---

## File Structure Summary

```
src/
├── app/(dashboard)/seo/
│   ├── page.tsx                    # Update: add schema card
│   └── schema/
│       └── page.tsx                # NEW: main page
├── components/schema/
│   ├── schema-type-selector.tsx    # NEW: type selection UI
│   ├── schema-form.tsx             # NEW: dynamic form
│   ├── repeatable-field.tsx        # NEW: array fields
│   ├── json-ld-preview.tsx         # NEW: output preview
│   └── validation-display.tsx      # NEW: validation status
├── lib/
│   ├── schema-templates.ts         # NEW: type templates
│   ├── schema-generator.ts         # NEW: JSON-LD generation
│   └── schema-validation.ts        # NEW: validation logic
├── hooks/
│   └── use-schema-form.ts          # NEW: form state hook
└── types/
    └── schema-markup.ts            # NEW: TypeScript types
```

---

## Implementation Order

### Step 1: Types & Templates
1. Create `src/types/schema-markup.ts`
2. Create `src/lib/schema-templates.ts` with 3 initial types (Organization, Product, FAQPage)

### Step 2: Core Logic
3. Create `src/lib/schema-generator.ts`
4. Create `src/lib/schema-validation.ts`

### Step 3: UI Components
5. Create `src/components/schema/schema-type-selector.tsx`
6. Create `src/components/schema/repeatable-field.tsx`
7. Create `src/components/schema/json-ld-preview.tsx`
8. Create `src/components/schema/validation-display.tsx`
9. Create `src/components/schema/schema-form.tsx`

### Step 4: Main Page
10. Create `src/app/(dashboard)/seo/schema/page.tsx`
11. Update `src/app/(dashboard)/seo/page.tsx` (add navigation card)

### Step 5: Additional Schema Types
12. Add LocalBusiness template
13. Add Article template
14. Add BreadcrumbList template
15. Add remaining types (HowTo, Event, Person, Recipe, etc.)

---

## Key Design Decisions

### 1. No AI Generation (Pure Form-Based)
Unlike other tools in the app, this tool does NOT use AI generation. It's a pure form-to-JSON converter because:
- Schema.org has strict specifications
- AI could introduce invalid properties
- Deterministic output is preferred for structured data
- Faster user experience (no API calls)

### 2. Live Preview
JSON-LD updates in real-time as user types (debounced 300ms)

### 3. Dutch UI
All labels, descriptions, and validation messages in Dutch to match the existing app

### 4. Client Context Integration (Optional Enhancement)
Could pre-fill Organization fields from selected client's context:
- Organization name from client name
- Logo from client logo
- Contact info from client data

---

## Estimated Effort

| Phase | Complexity |
|-------|------------|
| Phase 1: Types & Templates | Low |
| Phase 2: UI Components | Medium |
| Phase 3: Core Logic | Medium |
| Phase 4: Main Page | Medium |
| Phase 5: All Schema Types | Medium |
| Phase 6: Testing | Low |

---

## Success Criteria

1. ✅ User can select from 6+ schema types
2. ✅ Dynamic form renders based on schema type
3. ✅ Required fields clearly marked
4. ✅ Repeatable fields work (add/remove)
5. ✅ JSON-LD generates in real-time
6. ✅ Output is valid JSON-LD (can be tested in Google)
7. ✅ Copy/download functionality works
8. ✅ Validation errors display clearly
9. ✅ Empty optional fields are excluded from output
10. ✅ Tool accessible from SEO hub navigation
