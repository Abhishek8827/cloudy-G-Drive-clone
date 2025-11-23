// src/components/SignIn.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./css/auth.css";
import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

// Use the developer-uploaded logo image (local path provided)
const DEV_LOGO = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRsf_zUICQCcIRozLLu5Mc9TCqb4_NvIhE8pQ&s";

export default function SignIn() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleGoogleSignIn() {
    setError("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate("/drive", { replace: true });
    } catch (e) {
      console.error("Google sign-in failed", e);
      setError("Google sign-in failed. See console for details.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate("/drive", { replace: true });
    } catch (err) {
      console.error("Email auth error", err);
      if (err.code === "auth/user-not-found") setError("No account found for this email.");
      else if (err.code === "auth/wrong-password") setError("Incorrect password.");
      else if (err.code === "auth/email-already-in-use") setError("Email already in use.");
      else if (err.code === "auth/invalid-email") setError("Invalid email address.");
      else if (err.code === "auth/weak-password") setError("Password is too weak (min 6 characters).");
      else setError(err.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard" role="main" aria-labelledby="auth-title">
        <img src={DEV_LOGO} alt="Logo" className="authLogo" />
        <h1 id="auth-title" className="authTitle">Welcome to My Drive</h1>

        <button
          className="googleBtn"
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-label="Sign in with Google"
          type="button"
        >
          <span className="googleIcon" aria-hidden>
            {/* stylized 'G' using simple colored segments */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" focusable="false">
              <path fill="#4285F4" d="M17 9.2c0-.6-.1-1.1-.2-1.6H9v3h4.7c-.2 1-.9 2-2 2.6v2h3.2C16.6 14 17 11.7 17 9.2z"/>
              <path fill="#34A853" d="M9 18c2.4 0 4.4-.8 5.9-2.2l-3.2-2.4c-.8.5-1.8.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H1.1v2.1C2.6 15.8 5.6 18 9 18z"/>
              <path fill="#FBBC05" d="M4.5 10.9c-.2-.5-.4-1-.4-1.6s.1-1.1.4-1.6V5.6H1.1A8.9 8.9 0 000 9.3c0 1.5.4 2.9 1.1 4.1l3.4-2.5z"/>
              <path fill="#EA4335" d="M9 3.6c1.3 0 2.4.5 3.2 1.5l2.4-2.4C13.4.9 11.4 0 9 0 5.6 0 2.6 2.2 1.1 5.6l3.4 2.6C5.1 5 6.9 3.6 9 3.6z"/>
            </svg>
          </span>
          <span className="googleText">Continue with Google</span>
        </button>

        <div className="divider"><span>or</span></div>

        <form className="emailForm" onSubmit={handleEmailAuth} noValidate>
          <label className="inputLabel">
            <div className="labelText">Email</div>
            <input
              className="textInput"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="inputLabel">
            <div className="labelText">Password</div>
            <input
              className="textInput"
              type="password"
              placeholder="6+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div className="authError" role="alert">{error}</div>}

          <div className="formActions">
            <button type="submit" className="primaryBtn" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <button
              type="button"
              className="linkBtn"
              onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            >
              {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
            </button>
          </div>
        </form>

        <div className="smallNote">
          By continuing you agree to use this demo responsibly.
          <div style={{ marginTop: 6 }}>
            <Link to="/" className="linkSmall">Back to Landing</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
