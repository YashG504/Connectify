import axios from "axios";

// Update BASE_URL to use your environment variable
const BASE_URL = import.meta.env.MODE === "development" 
  ? "http://localhost:5001/api" 
  : "https://connectify-rhj7.onrender.com/api"; // Your Render URL

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, 
});