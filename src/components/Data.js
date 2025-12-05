import React, { useEffect, useState } from "react";
import "../css/data.css";
import { db, auth, storage } from "../firebase";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { ref as storageRef, deleteObject, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

export default function Data({ searchTerm, currentView, currentFolder, setCurrentFolder }) {
  const [gridVisible, setGridVisible] = useState(true);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // --- STATES ---
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameTarget, setRenameTarget] = useState(null); // 'file' or 'folder'
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null); 
  const [contextMenu, setContextMenu] = useState(null);

  // --- DRAG & DROP STATES ---
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- MULTI-SELECT STATE ---
  const [selectedIds, setSelectedIds] = useState(new Set());

  // --- AUTH ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubAuth();
  }, []);

  // --- FETCH DATA ---
  useEffect(() => {
    setLoading(true);
    const qFiles = query(collection(db, "files"), orderBy("uploadedAt", "desc"));
    const unsubFiles = onSnapshot(qFiles, (snapshot) => {
      setFiles(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const qFolders = query(collection(db, "folders"), orderBy("createdAt", "desc"));
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      setFolders(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);
    return () => { unsubFiles(); unsubFolders(); };
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Clear selection when view changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [currentView, currentFolder, searchTerm]);

  // --- HELPERS ---
  const formatSize = (bytes) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const getMimeType = (file) => (file.type || file.mimeType || "").toLowerCase();

  const renderFileThumbnail = (file) => {
    const mime = getMimeType(file);
    const name = (file.name || "").toLowerCase();

    if (mime.startsWith("image/") && file.downloadURL) {
      return <img src={file.downloadURL} alt={file.name} className="fileThumb" loading="lazy" />;
    }
    
    let icon = "description";
    let colorClass = "fileIcon--generic";

    if (mime === "application/pdf") { icon = "picture_as_pdf"; colorClass = "fileIcon--pdf"; }
    else if (name.endsWith(".doc") || name.endsWith(".docx")) { icon = "article"; colorClass = "fileIcon--word"; }
    else if (name.endsWith(".xls") || name.endsWith(".xlsx")) { icon = "table_view"; colorClass = "fileIcon--excel"; }
    else if (mime.startsWith("video/")) { icon = "movie"; colorClass = "fileIcon--video"; }
    else if (mime.startsWith("audio/")) { icon = "headphones"; colorClass = "fileIcon--audio"; }

    return (
      <div className={`fileIcon ${colorClass}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    );
  };

  // --- ACTIONS ---
  
  // 1. Soft Delete (Move to Trash)
  const handleSoftDelete = async (file) => {
    try {
      await updateDoc(doc(db, "files", file.id), { trashed: true });
    } catch (e) { alert("Delete failed"); }
  };

  // 2. Hard Delete (Single)
  const confirmHardDelete = (file) => {
    setFileToDelete(file);
    setConfirmDeleteOpen(true);
  };

  const executeHardDelete = async () => {
    if (!fileToDelete) return;
    try {
      if (fileToDelete.isFolder) {
         await deleteDoc(doc(db, "folders", fileToDelete.id));
      } else {
         if (fileToDelete.storagePath) {
             try { await deleteObject(storageRef(storage, fileToDelete.storagePath)); } 
             catch(err) { console.warn("Storage delete error", err); }
         }
         await deleteDoc(doc(db, "files", fileToDelete.id));
      }
    } catch (e) { alert("Delete failed"); }
    setConfirmDeleteOpen(false);
    setFileToDelete(null);
  };

  const handleRestore = async (file) => {
    try {
      await updateDoc(doc(db, "files", file.id), { trashed: false });
    } catch (e) { alert("Restore failed"); }
  };

  const handleRename = async () => {
    if (!activeFile || !renameValue.trim()) return;
    try {
      const collectionName = renameTarget === 'folder' ? 'folders' : 'files';
      await updateDoc(doc(db, collectionName, activeFile.id), { name: renameValue });
      setRenameOpen(false);
    } catch (e) { alert("Rename failed"); }
  };

  // --- DRAG AND DROP HANDLERS ---

  // 1. UPLOAD (Drag from OS -> Browser)
  const handleMainDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
       setDragActive(true);
    }
  };

  const handleMainDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleMainDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    // If dropping a file from OS
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesToUpload = Array.from(e.dataTransfer.files);
      if (!user) { alert("Please sign in"); return; }
      
      setUploading(true);
      
      for (const file of filesToUpload) {
        const path = `files/${user.uid}/${Date.now()}_${file.name}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, file);

        uploadTask.on("state_changed", null, 
          (err) => console.error(err),
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
          }
        );
      }
      setUploading(false); // Simplified; in real app track progress
    }
  };

  // 2. MOVE (Drag File -> Folder)
  const handleDragStart = (e, file) => {
    e.dataTransfer.setData("fileId", file.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.backgroundColor = "#e8f0fe"; // Visual feedback
  };

  const handleFolderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.backgroundColor = "transparent";
  };

  const handleFolderDrop = async (e, folder) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.backgroundColor = "transparent";

    const fileId = e.dataTransfer.getData("fileId");
    if (fileId) {
      try {
        await updateDoc(doc(db, "files", fileId), {
          parentId: folder.id,
          uploadedAt: serverTimestamp() // Optional: update time to show recent
        });
      } catch (err) {
        console.error("Move failed", err);
      }
    }
  };


  // --- BULK ACTIONS ---
  const toggleSelectAll = (checked, allFiles) => {
    if (checked) {
      const allIds = new Set(allFiles.map(f => f.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const promises = ids.map(id => updateDoc(doc(db, "files", id), { trashed: false }));
      await Promise.all(promises);
      setSelectedIds(new Set()); 
    } catch (e) {
      console.error(e);
      alert("Bulk restore failed");
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} items? This cannot be undone.`)) return;

    try {
      const promises = ids.map(async (id) => {
        const file = files.find(f => f.id === id);
        if (!file) return;
        if (file.storagePath) {
          try { await deleteObject(storageRef(storage, file.storagePath)); }
          catch(err) { console.warn("Storage delete error", err); }
        }
        await deleteDoc(doc(db, "files", id));
      });
      
      await Promise.all(promises);
      setSelectedIds(new Set()); 
    } catch (e) {
      console.error(e);
      alert("Bulk delete failed");
    }
  };

  // --- FILTERING ---
  const getFilteredData = () => {
    let finalFiles = files;
    let finalFolders = folders;

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      return {
        files: files.filter(f => f.name.toLowerCase().includes(lower)),
        folders: folders.filter(f => f.name.toLowerCase().includes(lower))
      };
    }

    if (currentView === "trash") return { files: files.filter(f => f.trashed), folders: [] };
    if (currentView === "starred") return { files: files.filter(f => f.starred && !f.trashed), folders: [] };
    if (currentView === "recent") return { files: files.filter(f => !f.trashed && !f.isVault), folders: [] };
    if (currentView === "vault") return { files: files.filter(f => f.isVault && !f.trashed), folders: [] };

    // My Drive
    finalFiles = finalFiles.filter(f => !f.trashed && !f.isVault);
    
    if (currentFolder) {
      finalFiles = finalFiles.filter(f => f.parentId === currentFolder.id);
      finalFolders = finalFolders.filter(f => f.parentId === currentFolder.id);
    } else {
      finalFiles = finalFiles.filter(f => !f.parentId);
      finalFolders = finalFolders.filter(f => !f.parentId);
    }

    return { files: finalFiles, folders: finalFolders };
  };

  const { files: filteredFiles, folders: filteredFolders } = getFilteredData();

  const openMenu = (e, item, type) => {
    e.preventDefault();
    e.stopPropagation();
    setRenameTarget(type);
    setContextMenu({ x: e.clientX, y: e.clientY, file: { ...item, isFolder: type === 'folder' } });
  };

  return (
    <div 
      className="data" 
      onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
      onDragOver={handleMainDragOver}
      onDragLeave={handleMainDragLeave}
      onDrop={handleMainDrop}
      style={{
        border: dragActive ? '2px dashed #1a73e8' : 'none',
        position: 'relative'
      }}
    >
      
      {/* UPLOAD INDICATOR */}
      {uploading && (
         <div style={{position:'absolute', top:10, left:'50%', transform:'translateX(-50%)', background:'#222', color:'#fff', padding:'8px 16px', borderRadius:20, zIndex:100, fontSize:14}}>
           Uploading files...
         </div>
      )}

      {/* HEADER */}
      <div className="data_header">
        <div className="data_headerLeft">
          <div className="driveLabelWrap">
             {/* TRASH: Select All */}
             {currentView === "trash" ? (
                <div style={{display:'flex', alignItems:'center', gap: 12}}>
                  <div style={{display:'flex', alignItems:'center', gap: 8, paddingRight: 10, borderRight:'1px solid #ddd'}}>
                    <input 
                      type="checkbox" 
                      style={{width:16, height:16, cursor:'pointer'}}
                      checked={filteredFiles.length > 0 && selectedIds.size === filteredFiles.length}
                      onChange={(e) => toggleSelectAll(e.target.checked, filteredFiles)}
                    />
                    <span className="driveLabelText" style={{color: selectedIds.size > 0 ? '#1a73e8' : 'inherit'}}>
                      {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Trash'}
                    </span>
                  </div>

                  {selectedIds.size > 0 && (
                    <div style={{display:'flex', gap: 8}}>
                      <button className="actionBtn" onClick={handleBulkRestore}>
                        <span className="material-symbols-outlined" style={{fontSize:18, verticalAlign:'middle', marginRight:4}}>restore_from_trash</span>
                        Restore
                      </button>
                      <button className="actionBtn" style={{color:'#d93025', borderColor:'#d93025', background:'#fff0f0'}} onClick={handleBulkDelete}>
                        <span className="material-symbols-outlined" style={{fontSize:18, verticalAlign:'middle', marginRight:4}}>delete_forever</span>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
             ) : (
                currentView === "myDrive" ? (
                  <>
                    <span className="driveLabelText" onClick={() => setCurrentFolder(null)} style={{cursor: 'pointer', color: currentFolder ? '#5f6368' : 'inherit'}}>My Drive</span>
                    {currentFolder && <span className="driveLabelText" style={{fontWeight:600}}> / {currentFolder.name}</span>}
                  </>
                ) : (
                  <span className="driveLabelText" style={{textTransform:'capitalize'}}>{currentView}</span>
                )
             )}
          </div>
        </div>
        <div className="data_headerRight">
           <button className="iconBtn" onClick={() => setGridVisible(!gridVisible)}>
             <span className="material-symbols-outlined">{gridVisible ? "view_list" : "grid_view"}</span>
           </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="data_content">
        {loading && <div style={{ padding: 20 }}>Loading...</div>}

        {!loading && filteredFiles.length === 0 && filteredFolders.length === 0 && (
          <div style={{ padding: 40, color: "gray", textAlign: "center" }}>
             {dragActive ? "Drop files here to upload" : "Empty"}
          </div>
        )}

        {/* FOLDERS SECTION */}
        {filteredFolders.length > 0 && (
           <div style={{padding:"10px 10px 0"}}>
              <div style={{fontSize:13, fontWeight:500, color:'#5f6368', marginBottom:10}}>Folders</div>
              <div className="data_grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', paddingBottom:0}}>
                 {filteredFolders.map(folder => (
                    <div 
                      key={folder.id} 
                      className="data_file"
                      style={{height:'48px', flexDirection:'row', alignItems:'center', padding:'0 15px', gap:10, position:'relative'}}
                      onDoubleClick={() => setCurrentFolder(folder)}
                      onContextMenu={(e) => openMenu(e, folder, 'folder')}
                      // DROP ZONE FOR FOLDERS
                      onDragOver={handleFolderDragOver}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleFolderDrop(e, folder)}
                    >
                       <span className="material-symbols-outlined" style={{color:'#5f6368', fontSize: '24px'}}>folder</span>
                       <p style={{border:0, padding:0, background:'transparent', height:'auto', margin:0, flex:1}}>{folder.name}</p>
                       <button className="iconBtn" style={{width:24, height:24, border:0, background:'transparent'}} onClick={(e) => openMenu(e, folder, 'folder')}>
                         <span className="material-symbols-outlined" style={{fontSize:18}}>more_vert</span>
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* FILES */}
        {filteredFiles.length > 0 && (
           <>
             {filteredFolders.length > 0 && <div style={{fontSize:13, fontWeight:500, color:'#5f6368', padding:"20px 10px 5px"}}>Files</div>}
             
             {gridVisible ? (
                <div className="data_grid">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`data_file ${selectedFileId === file.id ? "selected" : ""}`}
                      style={{
                        position:'relative', 
                        borderColor: selectedIds.has(file.id) ? '#1a73e8' : '',
                        backgroundColor: selectedIds.has(file.id) ? '#e8f0fe' : ''
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFileId(file.id); }}
                      onDoubleClick={(e) => { e.stopPropagation(); setActiveFile(file); }}
                      onContextMenu={(e) => openMenu(e, file, 'file')}
                      // DRAGGABLE
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, file)}
                    >
                      {/* Checkbox for Trash Grid */}
                      {currentView === 'trash' && (
                        <div style={{position:'absolute', top:8, left:8, zIndex:10}} onClick={e => e.stopPropagation()}>
                           <input 
                              type="checkbox" 
                              style={{width:16, height:16, cursor:'pointer'}} 
                              checked={selectedIds.has(file.id)}
                              onChange={() => toggleSelection(file.id)}
                           />
                        </div>
                      )}

                      <div className="thumbWrap">{renderFileThumbnail(file)}</div>
                      <p>
                        {file.isVault && <span className="material-symbols-outlined" style={{fontSize:14, marginRight:4, color:'#d93025'}}>lock</span>}
                        {file.name}
                      </p>
                      
                      {currentView !== 'trash' && (
                        <button className="iconBtn" style={{position:'absolute', top:8, right:8, background:'rgba(255,255,255,0.7)', width:28, height:28}} onClick={(e) => openMenu(e, file, 'file')}>
                           <span className="material-symbols-outlined" style={{fontSize:18}}>more_vert</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
             ) : (
                <div className="data_list" style={{ marginTop: 10 }}>
                  <div className="detailsRow headerRow">
                    {/* Checkbox Header for List */}
                    {currentView === 'trash' && <div style={{width: 30}}></div>}
                    <p className="colName"><b>Name</b></p>
                    <p><b>Owner</b></p>
                    <p><b>Date</b></p>
                    <p><b>Size</b></p>
                    <p><b>Actions</b></p>
                  </div>
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`detailsRow rows ${selectedFileId === file.id ? "selected" : ""}`}
                      style={{
                        backgroundColor: selectedIds.has(file.id) ? '#e8f0fe' : ''
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedFileId(file.id); }}
                      onDoubleClick={(e) => { e.stopPropagation(); setActiveFile(file); }}
                      onContextMenu={(e) => openMenu(e, file, 'file')}
                      // DRAGGABLE
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, file)}
                    >
                      {/* Checkbox for List Row */}
                      {currentView === 'trash' && (
                        <div style={{width: 30}} onClick={e => e.stopPropagation()}>
                           <input 
                              type="checkbox" 
                              style={{width:16, height:16, cursor:'pointer'}} 
                              checked={selectedIds.has(file.id)}
                              onChange={() => toggleSelection(file.id)}
                           />
                        </div>
                      )}

                      <p>
                         {file.isVault ? <span className="material-symbols-outlined" style={{fontSize:18, marginRight:8, color:'#d93025'}}>lock</span> : 
                          <span className="material-symbols-outlined" style={{marginRight: 8, color: file.starred ? "#f4b400" : "#dadce0", cursor: "pointer"}} onClick={(e) => {e.stopPropagation(); updateDoc(doc(db,"files",file.id),{starred:!file.starred})}}>
                             {file.starred ? "star" : "star_border"}
                          </span>}
                         {file.name}
                      </p>
                      <p>Me</p>
                      <p>{formatDate(file.uploadedAt)}</p>
                      <p>{formatSize(file.size)}</p>
                      
                      <div className="actionsCell">
                        {currentView === "trash" ? (
                           <>
                              <button className="smallBtn" onClick={(e) => { e.stopPropagation(); handleRestore(file); }} style={{marginRight:5}}>Restore</button>
                              <button className="smallBtn danger" onClick={(e) => { e.stopPropagation(); confirmHardDelete(file); }}>Delete Forever</button>
                           </>
                        ) : (
                           <>
                              <button className="iconBtn" title="Preview" onClick={() => setActiveFile(file)}>
                                <span className="material-symbols-outlined">visibility</span>
                              </button>
                              <button className="iconBtn" title="Menu" onClick={(e) => openMenu(e, file, 'file')}>
                                 <span className="material-symbols-outlined">more_vert</span>
                              </button>
                           </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
             )}
           </>
        )}
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          
           {renameTarget === 'file' && currentView !== 'trash' && (
              <>
                <div className="context-item" onClick={() => { setActiveFile(contextMenu.file); setContextMenu(null); }}>
                  <span className="material-symbols-outlined">visibility</span> Preview
                </div>
                <div className="context-item" onClick={() => { window.open(contextMenu.file.downloadURL); setContextMenu(null); }}>
                   <span className="material-symbols-outlined">download</span> Download
                </div>
                <div className="context-separator"></div>
              </>
           )}
           {/* --- STAR OPTION (Files & Folders) --- */}
           {currentView !== "trash" && (
             <div 
               className="context-item" 
               onClick={() => { 
                 // Determine collection based on item type
                 const collectionName = renameTarget === 'folder' ? 'folders' : 'files';
                 updateDoc(doc(db, collectionName, contextMenu.file.id), { starred: !contextMenu.file.starred }); 
                 setContextMenu(null); 
               }}
             >
               <span className="material-symbols-outlined">
                 {contextMenu.file.starred ? "star" : "star_border"}
               </span>
               {contextMenu.file.starred ? "Remove star" : "Add to Starred"}
             </div>
           )}
           <div className="context-item" onClick={() => { setRenameValue(contextMenu.file.name); setActiveFile(contextMenu.file); setRenameOpen(true); setContextMenu(null); }}>
             <span className="material-symbols-outlined">edit</span> Rename
           </div>
           
           {currentView === "trash" ? (
              <div className="context-item danger" onClick={() => { setContextMenu(null); confirmHardDelete(contextMenu.file); }}>
                <span className="material-symbols-outlined">delete_forever</span> Delete Forever
              </div>
           ) : (
              <div className="context-item" onClick={() => { setContextMenu(null); if(renameTarget === 'folder'){ confirmHardDelete(contextMenu.file); } else { handleSoftDelete(contextMenu.file); } }}>
                <span className="material-symbols-outlined">delete</span> {renameTarget === 'folder' ? 'Delete Folder' : 'Move to Trash'}
              </div>
           )}
        </div>
      )}

      {/* PREVIEW MODAL */}
      {activeFile && !renameOpen && !confirmDeleteOpen && (
        <div className="modalOverlay" onClick={() => setActiveFile(null)}>
          <div className="fileModal" onClick={(e) => e.stopPropagation()}>
            <div className="fileModalHeader">
              <div style={{ fontWeight: 700 }}>{activeFile.name}</div>
              <div style={{display:'flex', gap:10}}>
                 <button className="iconBtn" onClick={() => window.open(activeFile.downloadURL)}><span className="material-symbols-outlined">download</span></button>
                 <button className="iconBtn" onClick={() => setActiveFile(null)}><span className="material-symbols-outlined">close</span></button>
              </div>
            </div>
            <div className="fileModalBody">
               {getMimeType(activeFile).startsWith("image/") && (
                   <img src={activeFile.downloadURL} alt="preview" style={{ maxWidth: "100%", maxHeight: "70vh" }} />
               )}
               {getMimeType(activeFile).startsWith("video/") && (
                   <video controls src={activeFile.downloadURL} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
               )}
               {(getMimeType(activeFile) === "application/pdf" || activeFile.name.endsWith(".pdf")) && (
                   <iframe src={activeFile.downloadURL} title="PDF Preview" style={{ width: "100%", height: "70vh", border: "none" }} />
               )}
               {!getMimeType(activeFile).startsWith("image/") && 
                !getMimeType(activeFile).startsWith("video/") && 
                getMimeType(activeFile) !== "application/pdf" && 
                !activeFile.name.endsWith(".pdf") && (
                  <div style={{textAlign:'center', padding:40}}>
                     <span className="material-symbols-outlined" style={{fontSize:64, color:'gray', marginBottom:16}}>description</span>
                     <p>Preview not supported</p>
                     <a href={activeFile.downloadURL} target="_blank" rel="noreferrer" className="smallBtn">Download</a>
                  </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameOpen && (
        <div className="modalOverlay" onClick={() => setRenameOpen(false)}>
          <div className="confirmModal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename</h3>
            <input className="modalInput" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <div className="modalActions">
              <button className="btn" onClick={() => setRenameOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={handleRename}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDeleteOpen && (
        <div className="modalOverlay" onClick={() => { setConfirmDeleteOpen(false); setFileToDelete(null); }}>
          <div className="confirmModal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{color:'#d93025'}}>Delete forever?</h3>
            <p>"{fileToDelete?.name}" will be deleted forever.</p>
            <div className="modalActions">
              <button className="btn" onClick={() => { setConfirmDeleteOpen(false); setFileToDelete(null); }}>Cancel</button>
              <button className="btn danger" onClick={executeHardDelete}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}