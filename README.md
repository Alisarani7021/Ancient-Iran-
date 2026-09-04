# Eran - Historical Strategy Game

A Next.js historical strategy game where you build and manage a city across eras.

## Clone & Run with Termux (Android)

```bash
# Install dependencies in Termux
pkg update && pkg install git nodejs postgresql

# Clone the repo
git clone https://github.com/Alisarani7021/eran-historical-strategy-game.git
cd eran-historical-strategy-game

# Install npm packages
npm install

# Set up PostgreSQL (optional for full features)
# Create database and set DATABASE_URL
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db"

# Run development server
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Tech Stack

- Next.js 16
- React 19
- Drizzle ORM + PostgreSQL
- Tailwind CSS

## Project Structure

- `src/app` - Next.js App Router pages & API routes
- `src/components/game` - Game UI components
- `src/game` - Game engine, types and data
- `src/db` - Database schema
- `src/lib` - Auth & game store helpers
