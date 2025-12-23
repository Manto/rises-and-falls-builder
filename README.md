# Rises & Falls - Scene Outline Builder

A web app for creating, editing, and playing through scene outlines with branching narratives and variable-based conditions.

## Tech Stack

- **Backend**: Bun + Hono + SQLite (native `bun:sqlite`)
- **Frontend**: React + Vite + TypeScript

## Features

- **Characters**: Create and manage characters with names and descriptions
- **Locations**: Define locations where scenes take place
- **Variables**: Track state with numeric variables (e.g., trust, health, gold)
- **Scenes**: Build scenes with:
  - Characters present
  - Location setting
  - Description of what happens
  - Preconditions (variable requirements to unlock the scene)
  - Variable changes (effects when the scene is chosen)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed (v1.0+)

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash
```

### Setup

1. **Clone and navigate to the project**:
   ```bash
   cd rises-and-falls-builder
   ```

2. **Install backend dependencies**:
   ```bash
   cd backend
   bun install
   ```

3. **Install frontend dependencies**:
   ```bash
   cd ../frontend
   bun install
   ```

### Running the App

You need to run both the backend and frontend:

**Terminal 1 - Backend (runs on port 3000)**:
```bash
cd backend
bun run dev
```

**Terminal 2 - Frontend (runs on port 5173)**:
```bash
cd frontend
bun run dev
```

Then open http://localhost:5173 in your browser.

## Project Structure

```
rises-and-falls-builder/
├── backend/
│   ├── data/                 # SQLite database file location
│   ├── src/
│   │   ├── db/
│   │   │   ├── index.ts      # Database connection & init
│   │   │   ├── schema.sql    # Database schema
│   │   │   └── init.ts       # DB initialization script
│   │   ├── routes/
│   │   │   ├── characters.ts # Character CRUD endpoints
│   │   │   ├── locations.ts  # Location CRUD endpoints
│   │   │   ├── variables.ts  # Variable CRUD endpoints
│   │   │   └── scenes.ts     # Scene CRUD endpoints
│   │   ├── types.ts          # TypeScript types
│   │   └── index.ts          # Main server entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts     # API client functions
│   │   ├── pages/
│   │   │   ├── ScenesPage.tsx
│   │   │   ├── CharactersPage.tsx
│   │   │   ├── LocationsPage.tsx
│   │   │   └── VariablesPage.tsx
│   │   ├── App.tsx           # Main app with routing
│   │   ├── types.ts          # Shared types
│   │   └── index.css         # Global styles
│   └── package.json
│
└── README.md
```

## API Endpoints

### Characters
- `GET /api/characters` - List all characters
- `GET /api/characters/:id` - Get a character
- `POST /api/characters` - Create a character
- `PUT /api/characters/:id` - Update a character
- `DELETE /api/characters/:id` - Delete a character

### Locations
- `GET /api/locations` - List all locations
- `GET /api/locations/:id` - Get a location
- `POST /api/locations` - Create a location
- `PUT /api/locations/:id` - Update a location
- `DELETE /api/locations/:id` - Delete a location

### Variables
- `GET /api/variables` - List all variables
- `GET /api/variables/:id` - Get a variable
- `POST /api/variables` - Create a variable
- `PUT /api/variables/:id` - Update a variable
- `DELETE /api/variables/:id` - Delete a variable

### Scenes
- `GET /api/scenes` - List all scenes (with relationships)
- `GET /api/scenes/:id` - Get a scene with all relationships
- `POST /api/scenes` - Create a scene
- `PUT /api/scenes/:id` - Update a scene
- `DELETE /api/scenes/:id` - Delete a scene
- `POST /api/scenes/available` - Get scenes matching variable state

## Data Model

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Character  │     │   Scene     │     │  Location   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │◄────│ location_id │────►│ id          │
│ name        │     │ name        │     │ name        │
│ blurb       │     │ what        │     │ blurb       │
└─────────────┘     └──────┬──────┘     └─────────────┘
       ▲                   │
       │                   │
       │    ┌──────────────┼──────────────┐
       │    │              │              │
       │    ▼              ▼              ▼
┌──────┴────────┐  ┌─────────────┐  ┌─────────────┐
│scene_characters│  │Precondition │  │VariableChange│
├───────────────┤  ├─────────────┤  ├─────────────┤
│ scene_id      │  │ scene_id    │  │ scene_id    │
│ character_id  │  │ variable_id │  │ variable_id │
└───────────────┘  │ operator    │  │ delta       │
                   │ value       │  └──────┬──────┘
                   └──────┬──────┘         │
                          │                │
                          ▼                ▼
                   ┌─────────────┐
                   │  Variable   │
                   ├─────────────┤
                   │ id          │
                   │ name        │
                   │ description │
                   │ default_val │
                   └─────────────┘
```

## Future Features

- **Playthrough Mode**: Start with an initial scene and make choices
- **Scene Graph Visualization**: See how scenes connect
- **Export/Import**: Save and load scene data as JSON
- **Tags/Categories**: Organize scenes by type or chapter

