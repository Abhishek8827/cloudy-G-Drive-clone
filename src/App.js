// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Header from "./Header";
import Sidebar from "./Sidebar";
import Data from "./Data";

import SignIn from "./SignIn";
import PrivateRoute from "./PrivateRoute";

import "./index.css";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Redirect root → /drive */}
        <Route path="/" element={<Navigate to="/drive" replace />} />

        {/* Sign-in page */}
        <Route path="/signin" element={<SignIn />} />

        {/* Protected Drive route */}
        <Route
          path="/drive"
          element={
            <PrivateRoute>
              <div className="app-root">
                <Header />
                <div className="app-shell">
                  <Sidebar />
                  <Data />
                </div>
              </div>
            </PrivateRoute>
          }
        />

        {/* Any unknown URL → redirect to drive */}
        <Route path="*" element={<Navigate to="/drive" replace />} />
      </Routes>
    </Router>
  );
}