import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/header.css";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

// Use the provided local image path (developer-provided image)
const LOCAL_ACCOUNT_IMG = "/mnt/data/85305649-f90a-4e98-99c6-eb9bedf4b937.png";

export default function Header() {
  const [query, setQuery] = useState("");
  const [dark, setDark] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountsCollapsed, setAccountsCollapsed] = useState(false); // <-- added state (false = shown)

  const appsRef = useRef(null);
  const profileRef = useRef(null);
  const navigate = useNavigate();

  const apps = [
    { id: "account", title: "Account", iconType: "img", icon: "https://i.pravatar.cc/300" },
    { id: "drive", title: "Drive", iconType: "svg", icon: "add_to_drive" },
    { id: "business", title: "Business Profile", iconType: "svg", icon: "store" },
    { id: "gmail", title: "Gmail", iconType: "svg", icon: "mail" },
    { id: "youtube", title: "YouTube", iconType: "svg", icon: "play_circle" },
    { id: "gemini", title: "Gemini", iconType: "svg", icon: "stars" },
    { id: "maps", title: "Maps", iconType: "svg", icon: "place" },
    { id: "search", title: "Search", iconType: "svg", icon: "search" },
    { id: "calendar", title: "Calendar", iconType: "svg", icon: "calendar_month" },
    { id: "chrome", title: "Chrome", iconType: "svg", icon: "language" },
    { id: "news", title: "News", iconType: "svg", icon: "newspaper" },
    { id: "photos", title: "Photos", iconType: "svg", icon: "photo" },
  ];

  useEffect(() => {
    function onDocClick(e) {
      // close apps grid if click outside
      if (appsOpen && appsRef.current && !appsRef.current.contains(e.target)) {
        setAppsOpen(false);
      }
      // close profile dialog if click outside
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") {
        setAppsOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [appsOpen, profileOpen]);

  function onAppClick(app) {
    setAppsOpen(false);
    switch (app.id) {
      case "drive":
        navigate("/drive");
        break;
      case "gmail":
        window.open("https://mail.google.com", "_blank", "noopener");
        break;
      case "youtube":
        window.open("https://www.youtube.com", "_blank", "noopener");
        break;
      default:
        window.open(
          "https://www.google.com/search?q=" + encodeURIComponent(app.title),
          "_blank",
          "noopener"
        );
        break;
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out failed", err);
    } finally {
      navigate("/signin", { replace: true });
    }
  }

  function handleProfileToggle() {
    setProfileOpen((s) => !s);
    // ensure apps close if profile opens
    if (!profileOpen) setAppsOpen(false);
  }

  function handleAddAccount() {
    // placeholder: open account-add flow
    console.log("Add another account clicked");
    // navigate or open a flow as required
  }

  function handleSwitchAccount(accountId) {
    // placeholder: implement account switch behavior
    console.log("Switch to account:", accountId);
  }

  return (
    <>
      <div className={`header ${dark ? "dark" : "light"}`} role="banner">
        {/* LOGO */}
        <div className="header_logo" aria-hidden>
          <img
            src="https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png"
            alt="Drive logo"
          />
          <span className="logo_text">Drive</span>
        </div>

        {/* SEARCH */}
        <div className="header_search" role="search" aria-label="Search files">
          <span className="material-symbols-outlined">search</span>

          <input
            type="text"
            placeholder="Search here..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />

          {query !== "" && (
            <button
              className="clear_btn"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* ICONS */}
        <div className="header_icons" role="navigation" aria-label="Header actions">
          <div className="icons_left hil">
            <span className="material-symbols-outlined header-icon" title="Settings">
              settings
            </span>
            <span className="material-symbols-outlined header-icon" title="Help">
              help
            </span>
          </div>

          <div className="icons_right hil">
            <button
              className="header-icon appsBtn"
              onClick={() => setAppsOpen((s) => !s)}
              aria-haspopup="dialog"
              aria-expanded={appsOpen}
              title="Google apps"
            >
              <span className="material-symbols-outlined">apps</span>
            </button>

            <div
              className="profile_wrapper"
              onClick={handleProfileToggle}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleProfileToggle();
              }}
              aria-haspopup="dialog"
              aria-expanded={profileOpen}
            >
              <img
                src="https://i.pravatar.cc/300"
                className="profile_icon"
                alt="profile"
              />
            </div>

            {/* Sign out quick icon */}
            <button
              className="header-icon signoutBtn"
              onClick={handleLogout}
              title="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* APPS GRID DIALOG */}
      {appsOpen && (
        <div className="appsOverlay" role="dialog" aria-modal="true" aria-label="Google apps">
          <div className="appsDialog" ref={appsRef}>
            <div className="appsHeader">
              <div className="appsTitle">Google apps</div>
              <button
                className="appsClose"
                onClick={() => setAppsOpen(false)}
                aria-label="Close apps"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="appsGrid">
              {apps.map((a) => (
                <button key={a.id} className="appTile" onClick={() => onAppClick(a)} title={a.title}>
                  <div className="appIconWrap">
                    {a.iconType === "img" ? (
                      <img src={a.icon} alt={a.title} className="appTileImg" />
                    ) : (
                      <span className="material-symbols-outlined appTileSvg">{a.icon}</span>
                    )}
                  </div>
                  <div className="appTitle">{a.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE DIALOG (opens on profile_wrapper click) */}
      {profileOpen && (
        <div className="profileOverlay" role="dialog" aria-modal="true" aria-label="Account menu">
          <div className="profileDialog" ref={profileRef}>
            <div className="profileTop">
              <div className="profileEmail">tvsmkids@gmail.com</div>
              <button
                className="profileClose"
                onClick={() => setProfileOpen(false)}
                aria-label="Close profile"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="profileAvatarArea">
              <div className="avatarRing">
                <img src={"https://firebasestorage.googleapis.com/v0/b/drive-76237.firebasestorage.app/o/logo.png?alt=media&token=41717845-927f-4859-946d-a6b4af4f8fef"} alt="Account avatar" className="largeAvatar" />
              </div>
              <div className="greeting">Hi, Tvsm!</div>
              <a className="manageBtn" href="https://myaccount.google.com" target="_blank" rel="noreferrer">
                Manage your Google Account
              </a>
            </div>

            <div className="accountsSection">
              <button
                className="collapseBtn"
                onClick={() => setAccountsCollapsed((s) => !s)} // <-- toggles collapse
                aria-expanded={!accountsCollapsed}
                aria-controls="profile-accounts-list"
              >
                {accountsCollapsed ? "Show more accounts" : "Hide more accounts"}
                <span className={`material-symbols-outlined chev ${accountsCollapsed ? "" : "open"}`}>expand_more</span>
              </button>

              <div id="profile-accounts-list" className={`accountsList ${accountsCollapsed ? "collapsed" : "expanded"}`}>
                <div
                  className="accountRow"
                  onClick={() => handleSwitchAccount("abhishek")}
                  role="button"
                >
                  <img
                    className="accountThumb"
                    src="https://i.pravatar.cc/100"
                    alt="Abhishek"
                  />
                  <div className="accountInfo">
                    <div className="accountName">ABHISHEK WANI</div>
                    <div className="accountEmail">01abhishekwani@gmail.com</div>
                  </div>
                </div>

                <div
                  className="accountRow"
                  onClick={() => handleSwitchAccount("tvsm_school")}
                  role="button"
                >
                  <img
                    className="accountThumb"
                    src="https://i.pravatar.cc/500"
                    alt="Thakur Virendra Singh Memorial School"
                  />
                  <div className="accountInfo">
                    <div className="accountName">THAKUR VIRENDRA SINGH MEMORIAL SC...</div>
                    <div className="accountEmail">tvsmschoolnepanagar@gmail.com</div>
                  </div>
                  <div className="chev">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </div>
                </div>
              </div>

              <div className="profileActions">
                <button className="addAccount" onClick={handleAddAccount}>
                  Add another account
                </button>
                <button
                  className="signoutFull"
                  onClick={() => {
                    setProfileOpen(false);
                    handleLogout();
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
