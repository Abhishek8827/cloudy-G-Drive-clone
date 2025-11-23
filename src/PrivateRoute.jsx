// src/components/PrivateRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { auth } from "./firebase";

/**
 * PrivateRoute v6 - simple wrapper component.
 * Use it to protect your drive path ("/drive") so that only authenticated users can see it.
 *
 * Usage:
 * <Route path="/drive" element={<PrivateRoute><Data /></PrivateRoute>} />
 */
export default function PrivateRoute({ children }) {
  const user = auth.currentUser;
  // If you prefer reactive approach, choose to use an auth context or onAuthStateChanged and pass user via context.
  if (!user) {
    return <Navigate to="/signin" replace />;
  }
  return children;
}