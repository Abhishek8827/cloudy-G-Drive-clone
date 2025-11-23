import React, { useEffect, useState, useRef } from "react";
import "./css/data.css";
import { db, auth, storage } from "./firebase"; // adjust path
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

function Data() {
  const [gridVisible, setGridVisible] = useState(true);
  const [listVisible, setListVisible] = useState(true);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [user, setUser] = useState(null);
  const unsubscribeRef = useRef(null);

  // modal state: file details / preview
  const [activeFile, setActiveFile] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  function getFilesCollectionRef() {
    return collection(db, "files");
  }

  function mapDocToFile(docSnap) {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      name: data.name || data.fileName || data.originalName || "Untitled",
      ownerId: data.ownerId || data.owner || null,
      ownerName: data.ownerName || data.owner || data.uploadedBy || "Unknown",
      lastModifiedRaw:
        data.lastModified || data.updatedAt || data.uploadedAt || null,
      uploadedAtRaw: data.uploadedAt || null,
      size: data.size || data.fileSize || data.bytes || "—",
      storagePath: data.path || data.storagePath || null,
      mimeType: data.contentType || data.mimeType || data.type || "",
      downloadURL: data.downloadURL || null,
    };
  }

  function formatLastModifiedWithTime12h(raw) {
    if (!raw) return "Unknown";
    let dateObj;
    try {
      if (raw && typeof raw.toDate === "function") dateObj = raw.toDate();
      else if (typeof raw === "number") dateObj = new Date(raw);
      else dateObj = new Date(raw);
      if (isNaN(dateObj.getTime())) return String(raw);
    } catch (e) {
      return String(raw);
    }
    const options = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    };
    return dateObj.toLocaleString("en-GB", options);
  }

  function getExtension(file) {
    const name = file.name || (file.fileName ? file.fileName : "");
    const idx = name.lastIndexOf(".");
    if (idx > -1 && idx < name.length - 1)
      return name.slice(idx + 1).toLowerCase();
    const mime = file.mimeType || file.type || "";
    if (mime) {
      const parts = mime.split("/");
      return parts[1] ? parts[1].split("+")[0] : parts[0];
    }
    return "file";
  }

  function formatSize(size) {
    if (size == null) return "—";
    if (typeof size === "string") return size;
    const b = Number(size);
    if (isNaN(b)) return String(size);
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
      })
      .catch((e) => {
        console.error("persistence error", e);
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRealtimeListener() {
    setLoading(true);
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current();
      } catch (e) {}
      unsubscribeRef.current = null;
    }

    const colRef = getFilesCollectionRef();
    let qRef;
    try {
      qRef = query(colRef, orderBy("uploadedAt", "desc"));
    } catch (e) {
      qRef = colRef;
    }

    const unsub = onSnapshot(
      qRef,
      (snapshot) => {
        try {
          setFiles(snapshot.docs.map(mapDocToFile));
        } catch (mapErr) {
          console.error("map err", mapErr);
          setFiles([]);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("onSnapshot err", err);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsub;
  }

  useEffect(() => {
    startRealtimeListener();
    return () => {
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current();
        } catch (e) {}
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* -------------------------------
     permissions and actions
  -------------------------------*/
  function canModify(file) {
    if (!file) return false;
    if (!file.ownerId) return true; // public document allowed
    if (user && file.ownerId && user.uid === file.ownerId) return true;
    return false;
  }

  // open file modal
  function openFileModal(file) {
    setActiveFile(file);
    setRenameOpen(false);
    setConfirmDeleteOpen(false);
  }

  // preview helpers: returns type string
  function previewType(file) {
    if (!file || !file.mimeType) return "unknown";
    if (file.mimeType.startsWith("image/")) return "image";
    if (file.mimeType === "application/pdf") return "pdf";
    if (file.mimeType.startsWith("video/")) return "video";
    if (file.mimeType.startsWith("audio/")) return "audio";
    return "other";
  }

  // RENDER: thumbnail / icon helper
  function renderFileThumbnail(file, size = 56) {
    const type = previewType(file);
    const ext = getExtension(file);

    // images: use inline thumbnail
    if (type === "image" && file.downloadURL) {
      return (
        <img
          src={file.downloadURL}
          alt={file.name}
          className="fileThumb"
          loading="lazy"
          style={{ width: size, height: size }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      );
    }

    // video: attempt to show poster if available (not always), else generic video icon
    if (type === "video") {
      return (
        <div
          className="fileIcon fileIcon--video"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span className="material-symbols-outlined">videocam</span>
        </div>
      );
    }

    if (type === "pdf") {
      return (
        <div
          className="fileIcon fileIcon--pdf"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span className="material-symbols-outlined">picture_as_pdf</span>
        </div>
      );
    }

    if (type === "audio") {
      return (
        <div
          className="fileIcon fileIcon--audio"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span className="material-symbols-outlined">audiotrack</span>
        </div>
      );
    }

    // fallback: generic icon with extension badge
    return (
      <div
        className="fileIcon fileIcon--generic"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span className="material-symbols-outlined">description</span>
        <div className="extBadge">{ext}</div>
      </div>
    );
  }

  async function handleRenameConfirm() {
    if (!activeFile) return;
    const trimmed = (renameValue || "").trim();
    if (!trimmed) return alert("Name cannot be empty.");
    setSavingId(activeFile.id);
    try {
      const docRef = doc(db, "files", activeFile.id);
      await updateDoc(docRef, { name: trimmed, updatedAt: serverTimestamp() });
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFile.id ? { ...f, name: trimmed } : f))
      );
      setActiveFile((f) => (f ? { ...f, name: trimmed } : f));
      setRenameOpen(false);
    } catch (err) {
      console.error("rename failed", err);
      alert("Rename failed. See console.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!activeFile) return;
    if (!canModify(activeFile)) {
      alert("You can only delete files you own.");
      return;
    }
    setSavingId(activeFile.id);
    try {
      // delete storage object if path present
      if (activeFile.storagePath) {
        try {
          const sRef = storageRef(storage, activeFile.storagePath);
          await deleteObject(sRef);
        } catch (e) {
          console.warn("storage delete failed", e);
        }
      }
      // delete firestore doc
      const docRef = doc(db, "files", activeFile.id);
      await deleteDoc(docRef);
      setFiles((prev) => prev.filter((f) => f.id !== activeFile.id));
      setActiveFile(null);
      setConfirmDeleteOpen(false);
    } catch (err) {
      console.error("delete failed", err);
      alert("Delete failed. See console.");
    } finally {
      setSavingId(null);
    }
  }

  // sign-in from main area if needed
  async function ensureSignedIn() {
    if (auth.currentUser) return true;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (err) {
      console.error("signin failed", err);
      return false;
    }
  }

  /* UI */
  return (
    <div className="data">
      <div className="data_header">
        <div className="data_headerLeft">
          <div className="driveLabelWrap">
            <button
              className={`driveArrowBtn ${gridVisible ? "open" : "closed"}`}
              onClick={() => setGridVisible((p) => !p)}
              aria-expanded={gridVisible}
              aria-label={gridVisible ? "Collapse" : "Expand"}
            >
              <span className="driveLabelText">My Drive</span>
              <span className="material-symbols-outlined">
                keyboard_arrow_down
              </span>
            </button>
          </div>
        </div>

      
      </div>

      <div className="data_content">
        <div
          className={`data_grid ${gridVisible ? "" : "collapsed"}`}
          aria-hidden={!gridVisible}
        >
          {files.length === 0 ? (
            <div className="data_file">
              <span className="material-symbols-outlined">
                insert_drive_file
              </span>
              <p>No files</p>
            </div>
          ) : (
            files.map((f) => (
              <div
                key={f.id}
                className="data_file"
                title={f.name}
                onClick={() => openFileModal(f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openFileModal(f);
                }}
              >
                {/* thumbnail or icon */}
                <div className="thumbWrap">{renderFileThumbnail(f, 64)}</div>
                <p>{f.name}</p>
              </div>
            ))
          )}
        </div>

        <div className="data_list">
          <div className="detailsRow headerRow">
            <p
              className="colName"
              onClick={() => setListVisible((p) => !p)}
              role="button"
              tabIndex={0}
            >
              <b>
                Name{" "}
                <span
                  className={`material-symbols-outlined nameArrow ${
                    listVisible ? "open" : "closed"
                  }`}
                >
                  keyboard_arrow_down
                </span>
              </b>
            </p>
            <p>
              <b>Owner</b>
            </p>
            <p>
              <b>Last Modified</b>
            </p>
            <p>
              <b>File Size</b>
            </p>
            <p>
              <b>Type</b>
            </p>
            <p>
              <b>Actions</b>
            </p>
          </div>

          {loading ? (
            <div className="detailsRow rows">
              <p>Loading files…</p>
            </div>
          ) : files.length === 0 ? (
            <div className="detailsRow rows">
              <p>No files to show — upload from the sidebar.</p>
            </div>
          ) : (
            files.map((file) => {
              const modifiable = canModify(file);
              const ownerLabel =
                user && file.ownerId && user.uid === file.ownerId
                  ? "Me"
                  : file.ownerName || "Unknown";
              const lastModified =
                file.uploadedAtRaw || file.lastModifiedRaw || null;

              return (
                <div
                  key={file.id}
                  className={`detailsRow rows ${
                    listVisible ? "" : "collapsed"
                  }`}
                  tabIndex={0}
                  onClick={() => openFileModal(file)}
                >
                  <p title={file.name}>
                    <span className="listThumb">
                      {renderFileThumbnail(file, 40)}
                    </span>
                    {file.name}
                  </p>

                  <p title={file.ownerName}>{ownerLabel}</p>

                  <p title={String(lastModified)}>
                    {formatLastModifiedWithTime12h(lastModified)}
                  </p>

                  <p title={String(file.size)}>{formatSize(file.size)}</p>

                  <p className="fileType">{getExtension(file)}</p>

                  <p className="actionsCell">
                    {/* remove preview button — click row opens modal with preview + actions */}
                    <button
                      className="iconBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFile(file);
                      }}
                      title="Open"
                      aria-label={`Open ${file.name}`}
                    >
                      <span className="material-symbols-outlined">
                        open_in_new
                      </span>
                    </button>

                    <button
                      className="iconBtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameOpen(true);
                        setRenameValue(file.name);
                        setActiveFile(file);
                      }}
                      disabled={!modifiable || savingId === file.id}
                      title={
                        !modifiable
                          ? "You can only rename your own files"
                          : "Rename"
                      }
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>

                    <button
                      className="iconBtn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteOpen(true);
                        setActiveFile(file);
                      }}
                      disabled={!modifiable || savingId === file.id}
                      title={
                        !modifiable
                          ? "You can only delete your own files"
                          : "Delete"
                      }
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FILE MODAL (preview + actions) */}
      {activeFile && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveFile(null)}
        >
          <div className="fileModal" onClick={(e) => e.stopPropagation()}>
            <div className="fileModalHeader">
              <div style={{ fontWeight: 700 }}>{activeFile.name}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="iconBtn"
                  onClick={() => {
                    setRenameOpen(true);
                    setRenameValue(activeFile.name);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="iconBtn danger"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
                <button
                  className="iconBtn"
                  onClick={() => setActiveFile(null)}
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="fileModalBody">
              {/* preview */}
              {activeFile.downloadURL ? (
                (() => {
                  const t = previewType(activeFile);
                  if (t === "image") {
                    return (
                      <img
                        src={activeFile.downloadURL}
                        alt={activeFile.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "60vh",
                          objectFit: "contain",
                        }}
                      />
                    );
                  }
                  if (t === "pdf") {
                    return (
                      <iframe
                        title="pdf-preview"
                        src={activeFile.downloadURL}
                        style={{ width: "100%", height: "64vh", border: 0 }}
                      />
                    );
                  }
                  if (t === "video") {
                    return (
                      <video
                        controls
                        style={{ maxWidth: "100%", maxHeight: "64vh" }}
                        src={activeFile.downloadURL}
                      />
                    );
                  }
                  if (t === "audio") {
                    return (
                      <audio
                        controls
                        src={activeFile.downloadURL}
                        style={{ width: "100%" }}
                      />
                    );
                  }
                  // fallback: show download link
                  return (
                    <div>
                      <p>No inline preview available for this file type.</p>
                      <a
                        href={activeFile.downloadURL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in new tab
                      </a>
                    </div>
                  );
                })()
              ) : (
                <div>
                  <p>No preview available (missing downloadURL).</p>
                </div>
              )}
            </div>

            <div className="fileModalFooter">
              <div style={{ fontSize: 13, color: "#666" }}>
                Owner: {activeFile.ownerName || "Unknown"} • Size:{" "}
                {formatSize(activeFile.size)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  className="actionBtn"
                  href={activeFile.downloadURL || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download
                </a>
                <button
                  className="actionBtn"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      activeFile.downloadURL || ""
                    );
                    alert("Download link copied.");
                  }}
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameOpen && activeFile && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setRenameOpen(false)}
        >
          <div className="confirmModal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Rename file</div>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              style={{
                width: "100%",
                padding: 8,
                marginBottom: 12,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            />
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button className="smallBtn" onClick={() => setRenameOpen(false)}>
                Cancel
              </button>
              <button className="smallBtn" onClick={handleRenameConfirm}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {confirmDeleteOpen && activeFile && (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div className="confirmModal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Delete "{activeFile.name}"?
            </div>
            <div style={{ marginBottom: 12, color: "#666" }}>
              This will permanently delete the file. This action cannot be
              undone.
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                className="smallBtn"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                Cancel
              </button>
              <button className="smallBtn danger" onClick={handleDeleteConfirm}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Data;