# NVIAM CODE - Frontend

Professional IDE Frontend built with React, Vite, and TailwindCSS.

## 🚀 Tech Stack

- **Framework**: React (Vite)
- **Styling**: TailwindCSS
- **Editor**: Monaco Editor
- **Runtime**: WebContainer API (In-browser Node.js)
- **State**: Context API
- **Deployment**: Vercel

## 🛠️ Local Development

1.  **Install Dependencies**

    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env`:

    ```bash
    cp .env.example .env
    ```

    Set your variables:
    - `VITE_API_URL`: URL of your backend (e.g., `http://localhost:3000` or production URL).

3.  **Run Dev Server**
    ```bash
    npm run dev
    ```

## ☁️ Deployment (Vercel)

1.  **Import Project**: Select the `frontend` folder as the root directory.
2.  **Output Directory**: `dist` (default).
3.  **Install Command**: `npm install` (default).
4.  **Environment Variables**:
    - Add `VITE_API_URL`: Your production Backend URL (from Railway).

## 📄 Maintained by NVIAM
