// src/components/Trash.js
import React, { useEffect, useState } from "react";
import "./css/data.css";
import { db, storage, auth } from "./firebase";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,addDoc
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";

export default function Trash() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrash();
  }, []);

  async function loadTrash() {
    setLoading(true);
    try {
      const q = query(collection(db, "trash"), orderBy("trashedAt", "desc"));
      const snapshot = await getDocs(q);
      setFiles(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Failed to load trash", e);
      alert("Failed to load trash files.");
    } finally {
      setLoading(false);
    }
  }

  async function restoreFile(file) {
    try {
      // Move back to "files"
      const fileData = { ...file, restoredAt: new Date() };
      await addDoc(collection(db, "files"), fileData);
      await deleteDoc(doc(db, "trash", file.id));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      alert(`Restored "${file.name}"`);
    } catch (err) {
      console.error("Restore failed", err);
      alert("Failed to restore file.");
    }
  }

  async function permanentlyDelete(file) {
    if (!window.confirm(`Permanently delete "${file.name}"?`)) return;
    try {
      // delete from storage if exists
      if (file.storagePath) {
        try {
          const sRef = storageRef(storage, file.storagePath);
          await deleteObject(sRef);
        } catch (err) {
          console.warn("Storage delete failed", err);
        }
      }
      await deleteDoc(doc(db, "trash", file.id));
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      alert(`Permanently deleted "${file.name}".`);
    } catch (err) {
      console.error("Permanent delete failed", err);
      alert("Failed to delete permanently.");
    }
  }

  return (
    <div className="data">
      <div className="data_header">
        <h2>Trash</h2>
        <button className="actionBtn" onClick={loadTrash}>
          Refresh
        </button>
      </div>

      <div className="data_content">
        {loading ? (
          <p>Loading trashed files…</p>
        ) : files.length === 0 ? (
          <p>No files in Trash.</p>
        ) : (
          <div className="data_list">
            <div className="detailsRow headerRow">
              <p><b>Name</b></p>
              <p><b>Owner</b></p>
              <p><b>Trashed On</b></p>
              <p><b>Actions</b></p>
            </div>
            {files.map((file) => (
              <div key={file.id} className="detailsRow rows">
                <p>{file.name}</p>
                <p>{file.ownerName || "Unknown"}</p>
                <p>{file.trashedAt?.toDate?.().toLocaleString() || "Unknown"}</p>
                <p>
                  <button className="smallBtn" onClick={() => restoreFile(file)}>Restore</button>
                  <button className="smallBtn danger" onClick={() => permanentlyDelete(file)}>Delete Forever</button>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}