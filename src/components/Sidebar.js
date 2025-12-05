import React, { useRef, useState, useEffect } from "react";
import "../css/sidebar.css";
import { storage, db, auth } from "../firebase";
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy } from "firebase/firestore";

export default function Sidebar({ currentView, setCurrentView, currentFolder, setCurrentFolder }) {
  const [collapsed, setCollapsed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalSize, setTotalSize] = useState(0);

  // --- NEW MENU & MODAL STATES ---
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  
  // --- VAULT STATES ---
  const [vaultOpen, setVaultOpen] = useState(false); 
  const [vaultPin, setVaultPin] = useState("");
  const [vaultError, setVaultError] = useState("");
  
  const [pinResetTrigger, setPinResetTrigger] = useState(0);

  // Expand states
  const [myDriveExpanded, setMyDriveExpanded] = useState(true);
  
  // --- NEW: REAL FOLDERS STATE ---
  const [sidebarFolders, setSidebarFolders] = useState([]);

  const fileInputRef = useRef(null);
  const newButtonRef = useRef(null);
  const user = auth.currentUser;

  // --- CLICK OUTSIDE TO CLOSE NEW MENU ---
  useEffect(() => {
    function handleClickOutside(event) {
      if (newButtonRef.current && !newButtonRef.current.contains(event.target)) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- FETCH FOLDERS FOR SIDEBAR ---
  useEffect(() => {
    if (!user) return;
    // Fetch all folders owned by user
    const q = query(
      collection(db, "folders"), 
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSidebarFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => unsubscribe();
  }, [user]);

  // --- Calculate Storage ---
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "files"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let calculatedSize = 0;
      snapshot.forEach((doc) => {
        calculatedSize += doc.data().size || 0;
      });
      setTotalSize(calculatedSize);
    });
    return () => unsubscribe();
  }, [user]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalLimitGB = 2; 
  const totalLimitBytes = totalLimitGB * 1024 * 1024 * 1024;
  const usedPercent = Math.min((totalSize / totalLimitBytes) * 100, 100);

  // --- 1. HANDLE FILE UPLOAD ---
  async function handleFileChange(e) {
    setNewMenuOpen(false); 
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) { alert("Please sign in"); return; }

    setUploading(true);
    const path = `files/${user.uid}/${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(sRef, file);

    uploadTask.on(
      "state_changed",
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        
        const isVault = currentView === "vault";
        const parentId = (currentView === "myDrive" && currentFolder) ? currentFolder.id : null;

        await addDoc(collection(db, "files"), {
          name: file.name,
          size: file.size,
          type: file.type,
          downloadURL: url,
          storagePath: path,
          ownerId: user.uid,
          uploadedAt: serverTimestamp(),
          starred: false,
          trashed: false,
          isVault: isVault,    
          parentId: parentId,  
        });
        setUploading(false);
        setUploadProgress(0);
      }
    );
  }

  // --- 2. HANDLE CREATE FOLDER ---
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await addDoc(collection(db, "folders"), {
        name: newFolderName,
        ownerId: user.uid,
        parentId: currentFolder ? currentFolder.id : null, 
        createdAt: serverTimestamp(),
        path: currentFolder ? [...(currentFolder.path || []), {id: currentFolder.id, name: currentFolder.name}] : []
      });
      setCreateFolderOpen(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder");
    }
  };

  // --- 3. HANDLE VAULT ACCESS ---
  const handleVaultClick = () => {
    if (currentView === "vault") return; 
    setVaultPin("");
    setVaultError("");
    setVaultOpen(true);
  };

  const submitVaultPin = () => {
    const savedPin = localStorage.getItem("vaultPin_" + user.uid);
    
    if (!savedPin) {
      if (vaultPin.length < 4) {
        setVaultError("PIN must be at least 4 digits");
        return;
      }
      localStorage.setItem("vaultPin_" + user.uid, vaultPin);
      setPinResetTrigger(prev => prev + 1); 
      setVaultOpen(false);
      setCurrentView("vault");
      setCurrentFolder(null); 
    } else {
      if (vaultPin === savedPin) {
        setVaultOpen(false);
        setCurrentView("vault");
        setCurrentFolder(null);
      } else {
        setVaultError("Incorrect PIN");
      }
    }
  };

  const handleForgotPin = () => {
    if (window.confirm("Reset your Vault PIN? Since you are already signed in, you can create a new PIN immediately.")) {
      localStorage.removeItem("vaultPin_" + user.uid);
      setVaultPin("");
      setVaultError("");
      setPinResetTrigger(prev => prev + 1); 
    }
  };

  const isVaultSetup = !!localStorage.getItem("vaultPin_" + user?.uid);

  // --- FILTER: Only show root folders in sidebar (parentId == null) ---
  const rootFolders = sidebarFolders.filter(f => !f.parentId);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Upload Popup */}
      {uploading && (
        <div className="uploadPopup">
          <div className="uploadPopupHeader"><span>Uploading...</span><span>{uploadProgress}%</span></div>
          <div className="uploadPopupProgress"><div className="uploadPopupFill" style={{ width: `${uploadProgress}%` }} /></div>
        </div>
      )}

      {/* 1. TOP SECTION */}
      <div className="sidebar-top">
        <div className="new-btn-wrapper" ref={newButtonRef} style={{position:'relative'}}>
          <button 
            className="new-btn" 
            onClick={() => setNewMenuOpen(!newMenuOpen)} 
            title="New"
          >
            <span className="material-symbols-outlined plus-icon">add</span>
            {!collapsed && <span className="new-text">New</span>}
          </button>
          
          {newMenuOpen && (
            <div className="new-dropdown">
              <div className="new-dropdown-item" onClick={() => setCreateFolderOpen(true)}>
                <span className="material-symbols-outlined">create_new_folder</span>
                <span>New Folder</span>
              </div>
              <div className="new-dropdown-itemSeparator"></div>
              <div className="new-dropdown-item" onClick={() => fileInputRef.current.click()}>
                <span className="material-symbols-outlined">upload_file</span>
                <span>File Upload</span>
              </div>
            </div>
          )}
        </div>
        <input type="file" ref={fileInputRef} hidden onChange={handleFileChange} />
      </div>

      {/* 2. NAVIGATION */}
      <div className="sidebar-nav">
        <div 
          className={`nav-item ${currentView === "home" ? "active" : ""}`}
          onClick={() => { setCurrentView("home"); setCurrentFolder(null); }}
        >
          <span className="material-symbols-outlined nav-icon">home</span>
          {!collapsed && <span className="nav-text">Home</span>}
        </div>

        <div 
          className={`nav-item ${currentView === "myDrive" && !currentFolder ? "active" : ""}`}
          onClick={() => { setCurrentView("myDrive"); setCurrentFolder(null); }}
        >
           {!collapsed && (
            <span 
              className="material-symbols-outlined arrow-icon" 
              onClick={(e) => { e.stopPropagation(); setMyDriveExpanded(!myDriveExpanded); }}
            >
              {myDriveExpanded ? "arrow_drop_down" : "arrow_right"}
            </span>
          )}
          <span className="material-symbols-outlined nav-icon">hard_drive</span>
          {!collapsed && <span className="nav-text">My Drive</span>}
        </div>

        {/* --- DYNAMIC FOLDERS LIST --- */}
        {myDriveExpanded && !collapsed && (
          <div className="sub-folder-container">
             {rootFolders.map(folder => (
               <div 
                 key={folder.id}
                 className={`nav-item sub-item ${currentFolder?.id === folder.id ? "active" : ""}`}
                 onClick={() => { setCurrentView("myDrive"); setCurrentFolder(folder); }}
               >
                 <span className="material-symbols-outlined nav-icon" style={{fontSize: 18}}>folder</span>
                 <span className="nav-text">{folder.name}</span>
               </div>
             ))}
          </div>
        )}

        <div className="spacer"></div>

        <div className={`nav-item ${currentView === "recent" ? "active" : ""}`} onClick={() => { setCurrentView("recent"); setCurrentFolder(null); }}>
          <span className="material-symbols-outlined nav-icon">schedule</span>
          {!collapsed && <span className="nav-text">Recent</span>}
        </div>

        <div className={`nav-item ${currentView === "starred" ? "active" : ""}`} onClick={() => { setCurrentView("starred"); setCurrentFolder(null); }}>
          <span className="material-symbols-outlined nav-icon">star</span>
          {!collapsed && <span className="nav-text">Starred</span>}
        </div>

        {/* --- VAULT ITEM --- */}
        <div 
          className={`nav-item ${currentView === "vault" ? "active" : ""}`} 
          onClick={handleVaultClick} 
          style={{color: currentView === "vault" ? "#d93025" : ""}}
        >
          <span className="material-symbols-outlined nav-icon">lock</span>
          {!collapsed && <span className="nav-text">Vault</span>}
        </div>

        <div className={`nav-item ${currentView === "trash" ? "active" : ""}`} onClick={() => { setCurrentView("trash"); setCurrentFolder(null); }}>
          <span className="material-symbols-outlined nav-icon">delete</span>
          {!collapsed && <span className="nav-text">Bin</span>}
        </div>
      </div>

      {/* 3. STORAGE */}
      {!collapsed && (
        <div className="storage-section">
          <div className="storage-progress-bg">
            <div className="storage-progress-fill" style={{ width: `${usedPercent}%` }}></div>
          </div>
          <div className="storage-text">{formatBytes(totalSize)} of {totalLimitGB} GB used</div>
        </div>
      )}

      {/* 4. FOOTER */}
      <div className={`sidebar-footer-toggle ${collapsed ? "center" : "right"}`}>
         <button className="collapse-toggle" onClick={() => setCollapsed(!collapsed)}>
           <span className="material-symbols-outlined">{collapsed ? "chevron_right" : "chevron_left"}</span>
         </button>
      </div>

      {/* --- MODALS --- */}
      
      {/* Create Folder Modal */}
      {createFolderOpen && (
        <div className="modalOverlay" onClick={() => setCreateFolderOpen(false)}>
          <div className="confirmModal" onClick={e => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input 
              className="modalInput" 
              placeholder="Untitled folder" 
              autoFocus 
              value={newFolderName} 
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="modalActions">
              <button className="btn" onClick={() => setCreateFolderOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Vault PIN Modal */}
      {vaultOpen && (
        <div className="modalOverlay" onClick={() => setVaultOpen(false)}>
          <div className="confirmModal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', gap:10, alignItems:'center', marginBottom:10}}>
              <span className="material-symbols-outlined" style={{color:'#d93025', fontSize:28}}>lock</span>
              <h3>{isVaultSetup ? "Unlock Vault" : "Set Vault PIN"}</h3>
            </div>
            
            <p style={{fontSize:13, color:'gray', marginBottom:15}}>
              {isVaultSetup ? "Enter your secure PIN to access hidden files." : "Create a PIN to secure your private files."}
            </p>

            <input 
              className="modalInput" 
              type="password"
              placeholder="Enter PIN" 
              autoFocus 
              value={vaultPin} 
              onChange={e => { setVaultPin(e.target.value); setVaultError(""); }}
              onKeyDown={e => e.key === 'Enter' && submitVaultPin()}
            />
            
            {vaultError && <p style={{color:'red', fontSize:12, marginTop:-10, marginBottom:10}}>{vaultError}</p>}

            <div className="modalActions" style={{display:'flex', justifyContent: isVaultSetup ? 'space-between' : 'flex-end', alignItems:'center', width:'100%'}}>
              
              {isVaultSetup && (
                 <button 
                   type="button" 
                   style={{background:'none', border:'none', color:'#1a73e8', cursor:'pointer', fontSize:13, padding:0, textDecoration:'underline'}}
                   onClick={handleForgotPin}
                 >
                   Forgot PIN?
                 </button>
              )}

              <div style={{display:'flex', gap:10}}>
                  <button className="btn" onClick={() => setVaultOpen(false)}>Cancel</button>
                  <button className="btn primary" onClick={submitVaultPin}>
                    {isVaultSetup ? "Unlock" : "Set PIN"}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}