# Connectify - Fullstack Chat & Video Calling App

Welcome to **Connectify**, a highly scalable, full-stack real-time communication platform. Connectify empowers users to seamlessly chat and conduct video calls with a rich, responsive, and customizable user interface.

## 🚀 Features

- **Real-Time Messaging**: Lightning-fast instant messaging powered by Socket.io, complete with typing indicators and real-time event handling.
- **Video & Audio Calling**: High-quality 1-on-1 and group video/audio calls utilizing WebRTC (`simple-peer`) for seamless peer-to-peer communication.
- **Robust Authentication**: Secure, session-based authentication using JSON Web Tokens (JWT) and encrypted passwords (bcryptjs), ensuring your data and routes are completely protected.
- **Media Sharing**: Easily share images and files in real-time, managed securely via Cloudinary and Multer.
- **Dynamic Theming**: Personalize your experience with 32 unique, beautifully designed UI themes (powered by DaisyUI).
- **Responsive Design**: A fully responsive, mobile-first approach built with Tailwind CSS.
- **Optimized Performance**: Global state management with Zustand and robust data fetching/caching using TanStack Query.
- **Error Handling**: Comprehensive error tracking, structured logging (Pino), and secure HTTP headers (Helmet).

## 🛠️ Tech Stack

**Frontend:**
- React (via Vite)
- Tailwind CSS & DaisyUI
- Zustand (Global State)
- TanStack Query (Data Fetching)
- Socket.io-client & Simple-Peer (WebRTC)
- React Router

**Backend:**
- Node.js & Express
- MongoDB & Mongoose
- Socket.io (Real-time Engine)
- JSON Web Token (JWT)
- Cloudinary & Multer (Media Uploads)

---

## ⚙️ Local Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB URI
- Cloudinary Account (for image uploads)

### 1. Environment Variables (`.env`)

You will need to set up environment variables for both the backend and the frontend.

#### Backend (`/backend/.env`)
```env
PORT=5001
MONGO_URI=your_mongo_db_connection_string
JWT_SECRET_KEY=your_super_secret_jwt_key
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

#### Frontend (`/frontend/.env`)
```env
VITE_BACKEND_URL=http://localhost:5001
```

### 2. Running the Application

You can start the frontend and backend servers individually:

**Start the Backend server:**
```bash
cd backend
npm install
npm run dev
```

**Start the Frontend client:**
```bash
cd frontend
npm install
npm run dev
```

*Your backend will be running on `http://localhost:5001` and your frontend on `http://localhost:5173`.*

---

## 📝 License & Rights

**Developed and Maintained by Yash Ghotekar.**

&copy; 2026 Yash Ghotekar. All rights reserved. 
This project and its contents are the intellectual property of Yash Ghotekar. Unauthorized copying, modification, distribution, or use of this repository is strictly prohibited without explicit permission.
