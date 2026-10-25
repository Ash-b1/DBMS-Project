# Clinical Decision Support & Patient Case Retrieval System

An encounter-centric clinical database system for managing structured patient records, viewing doctor dashboard analytics, and retrieving similar historical clinical cases using vector similarity search.

## Technology Stack

- **Frontend:** Next.js, React
- **Backend:** Node.js, Express
- **Relational database:** MySQL
- **Vector database:** Chroma
- **Authentication:** JWT

## Project Structure

```text
DBMS-Project/
├── backend/
│   ├── routes/
│   ├── vector/
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── app/
    └── package.json
```

## Prerequisites

Install the following before running the application:

- Node.js and npm
- MySQL Server
- A running Chroma instance configured for the backend

## Setup

### 1. Configure the backend

Open a terminal in the project directory:

```bash
cd backend
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

Edit `backend/.env` and configure your MySQL connection, JWT secret, admin registration secret, and any account-related settings required by your backend.

**Do not commit `.env` or share its secrets.** Use placeholder values in `.env.example`.

### 2. Configure MySQL

Create the project database if it does not already exist:

```sql
CREATE DATABASE clinical_decision_support;
```

Configure the credentials in `backend/.env` and run the project's database setup procedure if required by your current schema.

### 3. Start the backend

From the `backend` directory:

```bash
npm run dev
```

The backend is expected to run on port `5000` with the default local configuration.

### 4. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Main Features

- Doctor dashboard with clinical analytics.
- Clinical case retrieval using Chroma vector similarity search.
- Structured clinical data stored in MySQL.
- Backend API endpoints for analytics and clinical case retrieval.

## Environment Configuration

See `backend/.env.example` for the environment-variable names expected by the backend. Configure local values in `backend/.env`.

Ensure the frontend's API URL matches the backend address and that Chroma is reachable using the configuration expected by the vector-search implementation.

## Development Checks

Run the frontend production build from the `frontend` directory:

```bash
npm run build
```

Run the backend using the scripts defined in `backend/package.json`.

## Important Notes

- Use synthetic or appropriately anonymized patient data during development.
- Do not commit passwords, tokens, or other secrets.
- Verify database configuration and clinical case retrieval before deployment.
- This project is for academic development and is not a substitute for professional medical judgment.
