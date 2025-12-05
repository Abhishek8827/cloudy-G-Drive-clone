// import React, { useState, useEffect } from "react";
// import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// import Header from "./components/Header";
// import Sidebar from "./components/Sidebar";
// import Data from "./components/Data";
// import SignIn from "./components/SignIn";
// import PrivateRoute from "./components/PrivateRoute";

// import "./index.css";

// export default function App() {
//   const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
//   const [searchTerm, setSearchTerm] = useState("");
  
//   // --- NEW: View State (myDrive, recent, starred, trash) ---
//   const [currentView, setCurrentView] = useState("myDrive");

//   const toggleTheme = () => {
//     setDarkMode((prev) => {
//       const newMode = !prev;
//       localStorage.setItem("theme", newMode ? "dark" : "light");
//       return newMode;
//     });
//   };

//   useEffect(() => {
//     document.body.classList.toggle("dark-mode", darkMode);
//   }, [darkMode]);

//   return (
//     <Router>
//       <Routes>
//         <Route path="/" element={<Navigate to="/drive" replace />} />
//         <Route path="/signin" element={<SignIn />} />
//         <Route
//           path="/drive"
//           element={
//             <PrivateRoute>
//               <div className={`app-root ${darkMode ? "dark-mode" : ""}`}>
//                 <Header 
//                   darkMode={darkMode} 
//                   toggleTheme={toggleTheme} 
//                   searchTerm={searchTerm} 
//                   setSearchTerm={setSearchTerm} 
//                 />
//                 <div className="app-shell">
//                   {/* Pass view state to Sidebar */}
//                   <Sidebar 
//                     currentView={currentView} 
//                     setCurrentView={setCurrentView} 
//                   />
//                   {/* Pass view state to Data to filter files */}
//                   <Data 
//                     searchTerm={searchTerm} 
//                     currentView={currentView} 
//                   />
//                 </div>
//               </div>
//             </PrivateRoute>
//           }
//         />
//         <Route path="*" element={<Navigate to="/drive" replace />} />
//       </Routes>
//     </Router>
//   );
// }

import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import GeminiPanel from "./components/GeminiPanel";

import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Data from "./components/Data";
import SignIn from "./components/SignIn";
import PrivateRoute from "./components/PrivateRoute";

import "./index.css";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [searchTerm, setSearchTerm] = useState("");
  
  const [geminiOpen, setGeminiOpen] = useState(false);

  // --- View State ---
  const [currentView, setCurrentView] = useState("myDrive"); // myDrive, recent, starred, trash, vault
  
  // --- Folder State (Option 3) ---
  const [currentFolder, setCurrentFolder] = useState(null); // null = Root, otherwise folder object

  const toggleTheme = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("theme", newMode ? "dark" : "light");
      return newMode;
    });
  };

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/drive" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route
          path="/drive"
          element={
            <PrivateRoute>
              <div className={`app-root ${darkMode ? "dark-mode" : ""}`}>
                <Header 
                  darkMode={darkMode} 
                  toggleTheme={toggleTheme} 
                  searchTerm={searchTerm} 
                  setSearchTerm={setSearchTerm} 
                />
                <div className="app-shell">
                  <Sidebar 
                    currentView={currentView} 
                    setCurrentView={setCurrentView}
                    currentFolder={currentFolder}      // Pass folder info for uploads
                    setCurrentFolder={setCurrentFolder} 
                  />
                  <Data 
                    searchTerm={searchTerm} 
                    currentView={currentView}
                    currentFolder={currentFolder}      // Pass folder info for display
                    setCurrentFolder={setCurrentFolder} 
                  />
                </div>
              </div>
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/drive" replace />} />
      </Routes>
      <GeminiPanel isOpen={geminiOpen} onClose={() => setGeminiOpen(false)} />
<button 
  onClick={() => setGeminiOpen(!geminiOpen)}
  style={{
    position: 'fixed', bottom: 20, right: 20, width: 50, height: 50,
    borderRadius: '50%', background: 'white', border: '1px solid #ddd',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1900
  }}
  title="Ask AI"
>
  <span className="material-symbols-outlined" style={{color: '#1a73e8', fontSize: 28}}>star_shine</span>
</button>
    </Router>
  );
}