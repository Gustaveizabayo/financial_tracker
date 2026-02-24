# Somabox Financial Tracker 

A full-stack collaborative project and budget management platform designed for seamless project tracking, task management, and expense monitoring.

## 🌟 Features

- **Project Management**: Create, view, and manage multiple projects with ease.
- **Task Tracking**: Assign tasks, update statuses, and track project progress.
- **Expense Monitoring**: log and categorize expenses per project to stay within budget.
- **Interactive Dashboard**: Visualize project health and financial data with dynamic charts (Recharts).
- **Notifications System**: Stay updated on task assignments and project changes.
- **Secure Authentication**: JWT-based user registration and login.
- **API Documentation**: Interactive Swagger/OpenAPI documentation for the backend.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React](https://reactjs.org/) (with [Vite](https://vitejs.dev/))
- **Styling**: Vanilla CSS (Modern UI/UX)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **State Management**: React Context API
- **Networking**: Axios

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Auth**: [JSON Web Token (JWT)](https://jwt.io/)
- **Validation**: [Express Validator](https://express-validator.github.io/docs/)
- **Documentation**: [Swagger UI](https://swagger.io/tools/swagger-ui/)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Gustaveizaabayo/financial_tracker.git
   cd financial_tracker
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   ```
   - Create a `.env` file in the `backend` folder based on `.env.example`.
   - Setup your PostgreSQL database and update connection strings.
   - Run migrations:
     ```bash
     npm run db:migrate
     ```
   - Start the server:
     ```bash
     npm run dev
     ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   ```
   - Create a `.env` file in the `frontend` folder.
   - Start the development server:
     ```bash
     npm run dev
     ```

## 📄 License

This project is licensed under the MIT License.
