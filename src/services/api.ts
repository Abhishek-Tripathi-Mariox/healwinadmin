// Example API service
// src/services/api.ts
const API_URL = "http://localhost:3000/api";

export const fetchCustomers = async () => {
  const response = await fetch(`${API_URL}/customers`);
  return response.json();
};
