# Delta — Minimalist Financial Tracking

Delta is a beautiful, responsive, and secure personal finance application designed for elegant daily transaction tracking, category-based budgeting, and visual analytics. It operates on a mobile-first philosophy, utilizing gorgeous off-white aesthetics, generous white space, and balanced micro-interactions.

---

## 🌟 Key Features

*   **Multi-Account Management:** Add and organize cash, bank, and debt accounts. Debt accounts support custom tracking directions (i.e. money you owe vs. money owed to you).
*   **Daily Transaction Logger:** Fast logging for income and expenses. Dynamically tag your entries and assign them custom-colored categories for quick grouping.
*   **Intelligent Analytics (Recharts-powered):**
    *   **Account Evolution:** Historical line chart tracking account balances and overall net worth over customizable periods (weekly, monthly, yearly).
    *   **Cash Flow Chart:** Combined bar/line visualization displaying income vs. expense over time.
    *   **Category Spending Pie Chart:** A high-contrast spending distribution breakdown showing exact proportions and budget health in a side-by-side bento card layout.
*   **Category Budgets & Thresholds:** Set monthly limit ceilings for each category. Dynamic progress bars change colors and show warning glows if you exceed your budgeted limits.
*   **Firebase Secure Backup & Auth:** Real-time cloud synchronization using Firebase Authentication (Email/Password) and Firestore. Easily sign up to persist data across multiple sessions, or proceed offline using standard, private local storage.
*   **Minimalist Light/Dark Modes:** Carefully structured Swiss-style UI that responds instantly to your preferences, keeping your visual load clean and high-contrast.
*   **CSV Exports:** Download your transaction ledger with a single tap for advanced spreadsheet analysis in Excel or Google Sheets.

---

## 🛠️ Tech Stack

*   **Runtime & Language:** Node.js, TypeScript
*   **Framework & Build Tool:** React 18, Vite
*   **Styling & Micro-Animations:** Tailwind CSS, `motion/react`
*   **Data Visualization:** Recharts, D3
*   **Icons:** Lucide React
*   **Database & Auth Engine:** Firebase Auth, Firestore

---

## 📁 Project Structure

```text
/
├── public/                 # Static vector SVG resources & icons
├── src/
│   ├── components/         # Modular React components
│   │   ├── accounts/       # Account creation forms & presentation cards
│   │   ├── layout/         # Responsive bottom navigation & page templates
│   │   ├── transactions/   # Fast loggers & historic lists
│   │   └── ui/             # Reusable custom inputs, select fields, and modal containers
│   ├── lib/                # SDK integrations (Firebase configuration)
│   ├── pages/              # Primary view controllers (Home, Stats, Accounts, Settings)
│   ├── providers/          # Global Context Providers (Auth, Data syncing, Theme state)
│   ├── utils/              # Helper engines (Financial arithmetic algorithms)
│   ├── App.tsx             # Route orchestration & primary wrapper
│   ├── types.ts            # Centralized TypeScript definitions and schemas
│   └── index.css           # Global typography, color schemes, and custom scrollbars
├── metadata.json           # Application descriptor permissions & capabilities
└── package.json            # Target dependencies & runtime scripts
```

---

## ⚡ Setup & Development

### Local Installation

1.  **Clone & Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Review `.env.example` and set up your Firestore credentials if hosting on a custom stack:
    ```env
    VITE_FIREBASE_API_KEY=your_api_key
    VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
    VITE_FIREBASE_PROJECT_ID=your_project_id
    VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    ```

3.  **Boot Development Server:**
    ```bash
    npm run dev
    ```

4.  **Production Build:**
    ```bash
    npm run build
    ```
