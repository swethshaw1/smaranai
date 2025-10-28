# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh


Frontend .env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID = 

Backend .env
FRONTEND_DOMAIN = "http://localhost:5173"
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password   # use Gmail App Password (not regular password)
ADMIN_EMAIL=admin@example.com
PORT=5000
SUPABASE_URL =
SUPABASE_KEY =
NODE_ENV = "development"
JWT_SECRET = "hard"
GOOGLE_CLIENT_ID = ""