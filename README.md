# 📊 Financial Telemetry Dashboard — Turnkey Personal Finance & Plaid Platform

A turnkey, full-stack personal finance and liquidity telemetry platform built with **React 18**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL + RLS)**, and the **Plaid API**.

Designed to give individuals a self-hosted, institutional-grade command center for real-time account balances, credit utilization, recurring obligations, and multi-horizon cash-flow projections.

---

## ✨ Key Architectural Features

### 1. Real-Time Plaid Account Linking & Bulk Balance Sync (`src/components/PlaidLink.tsx`, `api/plaid/`)
- **One-Click Institution Linking**: Serverless Plaid Link token exchange (`/api/plaid/create-link-token`, `/api/plaid/exchange-public-token`) to connect checking, savings, credit card, and brokerage accounts.
- **Account Mapping & Bulk Sync**: Map Plaid accounts to dashboard rows and refresh all balances simultaneously via `/api/plaid/get-balances`.

### 2. Multi-Horizon Liquidity & Cash-Flow Projections (`src/pages/Dashboard.tsx`)
- **Expected Balance Engine**: Dynamically forecasts checking liquidity before the next bi-weekly paycheck, end-of-week Friday, and two-paycheck horizon by netting unpaid credit card statements, recurring monthly bills, and scheduled income deposits.
- **Interactive Breakdown Modals**: Click any liquidity metric card to inspect an itemized, chronologically sorted ledger of every upcoming debit and deposit included in the projection.
- **Accounting-Grade Formatting**: Automatically formats negative balances in standard accounting notation `($123.45)` with color-coded recency telemetry indicators (*Green / Amber / Rose*).

### 3. Drag-and-Drop Admin Control Center (`src/pages/Admin.tsx`)
- **Full CRUD & Drag-and-Drop Ordering**: Built with `@dnd-kit` to reorder and edit Credit Cards, Bills, Banking Accounts, Investments, and Income Streams in real time.
- **Automated Monthly Date Rollover**: One-click **Sync Card Dates** and **Sync Bill Dates** roll due dates forward to the current month while clamping short-month edge cases (e.g., `31st` → `Feb 28th`).

### 4. Security & Privacy Architecture
- **Supabase JWT Authentication**: Email/password authentication with persistent session handling.
- **OWASP 15-Minute Idle Timeout (`src/hooks/useIdleTimeout.ts`)**: Automatically terminates unattended sessions across all routes.
- **PostgreSQL Row-Level Security (`schema.sql`)**: Database-level isolation for all financial tables.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, `@dnd-kit`, Lucide Icons
- **Backend & Database**: Supabase (PostgreSQL, Auth, RLS) + Vercel Serverless Functions (`api/plaid/`)
- **Financial Data API**: Plaid (`plaid`, `react-plaid-link`)
- **Build Tooling**: Vite 8

---

## 🚀 Turnkey Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/dmrusoff/Financial-Telemetry-Dashboard.git
   cd Financial-Telemetry-Dashboard
   npm install
   ```
2. **Initialize Supabase Schema**
   Run [`schema.sql`](./schema.sql) in your Supabase SQL Editor.
3. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
4. **Launch Development Server**
   ```bash
   npm run dev
   ```
