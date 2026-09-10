// src/api/tripApi.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Plan a trip via the backend.
 * @param {{ current_location: string, pickup_location: string, dropoff_location: string, current_cycle_used: number }} formData
 * @returns {Promise<{ route: object, daily_logs: object[] }>}
 */
export async function planTrip(formData) {
  try {
    const response = await axios.post(`${BASE_URL}/plan-trip/`, formData, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  } catch (err) {
    const backendMsg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.message ||
      'An unexpected error occurred. Please try again.';
    throw new Error(backendMsg, { cause: err });
  }
}
