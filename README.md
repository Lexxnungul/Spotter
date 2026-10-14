# Spotter

A modern web application built with Next.js 14, React 18, and Prisma.

## Overview

Spotter is a full-stack web application that provides [describe the core purpose of your application here]. It features a modern tech stack with Next.js for the frontend, Prisma for database ORM, and Vitest for testing.

## Features

- **Next.js 14** - React framework with App Router
- **React 18** - Latest React with concurrent features
- **Prisma** - Type-safe database ORM
- **Vitest** - Fast unit testing
- **ESLint** - Code linting and formatting
- **TypeScript** - Type-safe development

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Lexxnungul/Spotter.git
   cd Spotter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database connection string
   ```

4. Run Prisma migration:
   ```bash
   npx prisma migrate dev
   ```

5. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest tests
- `npm run build:tokens` - Build design tokens
- `npm run prisma:generate` - Generate Prisma client

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: CSS modules + Tailwind CSS (if configured)
- **Database**: PostgreSQL via Prisma ORM
- **Testing**: Vitest
- **Linting**: ESLint with Next.js config

## Project Structure

```
src/
  app/          - Next.js app router pages and layout
  components/   - Reusable React components
  __tests__/    - Test files
  styles/       - Global styles and CSS
prisma/         - Database schema and migrations
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev/docs)