# Meteorn Hub

Meteorn Hub is a community dashboard and administrative platform built with Next.js 16 and React 19. It features a complete environment for users to manage their profiles, access temporary emails, interact in a real-time world chat, and use the POL cryptocurrency faucet.

## Core Features
- **User Dashboard:** Track GMTO income, limits, and profile status.
- **Crypto Faucet:** Integrated POL faucet with donation-based upgrade tiers.
- **Temp Mail:** Disposable email service via Mail.tm API, featuring tiered limits.
- **Global Chat:** Real-time chat powered by Supabase with Giphy integration.
- **Analytics:** Data visualizations using Recharts and NumberFlow.
- **Admin Panel:** Complete management of users, domains, faucet requests, and settings.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Database / Auth:** Supabase
- **Styling:** Tailwind CSS, shadcn/ui, base-ui
- **Animations:** Motion, GSAP, Three.js
- **Icons:** Lucide React

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Ensure you have `.env.local` set up with the required Supabase and Mail.tm keys.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.
