// src/components/Sidebar.jsx
import React, { useRef, useState } from "react";
import "./css/sidebar.css";
import { storage, db, auth } from "./firebase"; // adjust path
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("myDrive");

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTaskRef, setUploadTaskRef] = useState(null);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);

  const fileInputRef = useRef(null);

  const folders = [
    { id: 1, name: "Projects", fileCount: 12 },
    { id: 2, name: "Personal", fileCount: 2 },
    { id: 3, name: "Work", fileCount: 10 },
    { id: 4, name: "Certificates", fileCount: 23 },
  ];

  const usedGB = 72;
  const totalGB = 100;
  const usedPercent = Math.round((usedGB / totalGB) * 100);

  function promptSignIn() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }

  async function handleUploadClick() {
    // require sign-in before showing file picker (so ownerId is always set)
    if (!auth.currentUser) {
      try {
        await promptSignIn();
      } catch (err) {
        console.error("Sign-in cancelled / failed:", err);
        return;
      }
    }
    if (fileInputRef.current) fileInputRef.current.click();
  }

  // cancel an ongoing upload
  function cancelUpload() {
    if (uploadTaskRef && typeof uploadTaskRef.cancel === "function") {
      try {
        uploadTaskRef.cancel(); // some SDKs expose cancel()
      } catch (e) {
        console.warn("upload cancel failed (attempting to stop):", e);
      }
    }
    // best-effort: stop showing UI
    setUploading(false);
    setUploadProgress(0);
    setUploadTaskRef(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // upload file to firebase storage and save metadata to firestore
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // ensure user present (defensive)
    if (!auth.currentUser) {
      try {
        await promptSignIn();
      } catch (err) {
        console.error("Sign-in cancelled / failed:", err);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    const path = `files/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(sRef, file);

    // store task ref to allow cancel
    setUploadTaskRef(uploadTask);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadProgress(percent);
      },
      (error) => {
        console.error("Upload error:", error);
        alert("Upload failed: " + (error?.message || error));
        setUploading(false);
        setUploadProgress(0);
        setUploadTaskRef(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const currentUser = auth.currentUser;

          const fileDoc = {
            name: file.name,
            path,
            downloadURL,
            size: file.size,
            contentType: file.type || null,
            uploadedAt: serverTimestamp(),
            ownerId: currentUser && currentUser.uid ? currentUser.uid : null,
            ownerName:
              (currentUser && (currentUser.displayName || currentUser.email)) ||
              "Unknown",
            // removed `source` badge per your request
          };

          const docRef = await addDoc(collection(db, "files"), fileDoc);

          setLastUploadInfo({ id: docRef.id, ...fileDoc });
          setUploadProgress(100);
        } catch (err) {
          console.error("Error saving metadata to Firestore:", err);
          alert(
            "Upload succeeded but saving metadata failed: " + (err?.message || err)
          );
        } finally {
          // show done state briefly before hiding
          setTimeout(() => {
            setUploading(false);
            setUploadProgress(0);
            setUploadTaskRef(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }, 700);
        }
      }
    );
  }

  return (
    <>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`} aria-label="Sidebar">
        {/* popup-style upload card when uploading */}
        {uploading && (
          <div className="uploadPopup" role="dialog" aria-modal="true" aria-label="Uploading">
            <div className="uploadPopupHeader">
              <div style={{ fontWeight: 700 }}>Uploading</div>
              <div style={{ opacity: 0.7 }}>{uploadProgress}%</div>
            </div>

            <div className="uploadPopupProgress">
              <div className="uploadPopupFill" style={{ width: `${uploadProgress}%` }} />
            </div>

            <div className="uploadPopupActions">
              <button className="smallBtn" onClick={cancelUpload}>Cancel</button>
              {uploadProgress === 100 ? (
                <button className="smallBtn" onClick={() => { setUploading(false); setUploadProgress(0); }}>
                  Done
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="sidebar-top">
          {!collapsed ? (
            <>
              <button
                className="sidebar-new-btn"
                title="Upload file"
                onClick={handleUploadClick}
                aria-label="Upload file"
              >
                <span className="material-symbols-outlined">upload</span>
                <span className="btn-text">New</span>
              </button>

              {/* hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </>
          ) : (
            <button
              className="sidebar-new-icon-btn"
              onClick={handleUploadClick}
              title="New"
              aria-label="New"
            >
              <span className="material-symbols-outlined">drive_file_move</span>
            </button>
          )}

          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed((s) => !s)}
            aria-pressed={collapsed}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <span className="material-symbols-outlined">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        <div className="sidebar-middle">
          <nav className="sidebar-nav" aria-label="Primary">
            <ul className="nav-list">
              <li
                className={`nav-item ${active === "myDrive" ? "active" : ""}`}
                onClick={() => setActive("myDrive")}
                title="My Drive"
                tabIndex={0}
              >
                <span className="material-symbols-outlined nav-icon">drive_file_move</span>
                <span className="nav-label">My Drive</span>
              </li>

              <li
                className={`nav-item ${active === "shared" ? "active" : ""}`}
                onClick={() => setActive("shared")}
                title="Shared with me"
                tabIndex={0}
              >
                <span className="material-symbols-outlined nav-icon">supervisor_account</span>
                <span className="nav-label">Shared with me</span>
              </li>

              <li
                className={`nav-item ${active === "starred" ? "active" : ""}`}
                onClick={() => setActive("starred")}
                title="Starred"
                tabIndex={0}
              >
                <span className="material-symbols-outlined nav-icon">star</span>
                <span className="nav-label">Starred</span>
              </li>

              <li
                className={`nav-item ${active === "recent" ? "active" : ""}`}
                onClick={() => setActive("recent")}
                title="Recent"
                tabIndex={0}
              >
                <span className="material-symbols-outlined nav-icon">history</span>
                <span className="nav-label">Recent</span>
              </li>

              <li
                className={`nav-item ${active === "trash" ? "active" : ""}`}
                onClick={() => setActive("trash")}
                title="Trash"
                tabIndex={0}
              >
                <span className="material-symbols-outlined nav-icon">delete_outline</span>
                <span className="nav-label">Trash</span>
              </li>
            </ul>
          </nav>

          <div className="folder-section">
            <div className="folder-title">Folders</div>

            <div className="folder-list" role="list">
              {folders.map((f) => (
                <div
                  key={f.id}
                  className={`folder-item ${active === `folder_${f.id}` ? "active" : ""}`}
                  onClick={() => setActive(`folder_${f.id}`)}
                  title={f.name}
                  tabIndex={0}
                >
                  <span className="material-symbols-outlined folder-icon">folder</span>

                  <div className="folder-meta">
                    <div className="folder-name">{f.name}</div>
                    <div className="folder-count">{f.fileCount} files</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-extra" aria-hidden />
        </div>

        <div className="sidebar-bottom">
          <div className="storage-area">
            <div className="storage-row">
              <div className="storage-text">
                <div className="used">{usedGB} GB used</div>
                <div className="total">of {totalGB} GB</div>
              </div>
              <div className="storage-icon">
                <span className="material-symbols-outlined">storage</span>
              </div>
            </div>

            <div className="storage-bar" aria-hidden>
              <div className="storage-fill" style={{ width: `${usedPercent}%` }} />
            </div>

            <button className="buy-storage-btn" onClick={() => alert("Open storage settings")}>
              Buy storage
            </button>

            {lastUploadInfo && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Last uploaded: {lastUploadInfo.name}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}