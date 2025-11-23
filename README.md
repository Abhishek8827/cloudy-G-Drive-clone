# Google Drive Clone

A React-based application that mimics Google Drive functionality with Firebase backend integration.

## Features

- File upload and storage
- Real-time file synchronization with Firestore
- File preview (images, PDFs, videos, audio)
- File management (rename, delete)
- Grid and list view modes
- User authentication with Google
- Responsive design with Material UI icons

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Firebase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/google-drive-clone.git
cd google-drive-clone
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Update `src/firebase.js` with your Firebase configuration

4. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`.

## Build

To create a production build:

```bash
npm run build
```

## Project Structure

```
src/
├── App.js              # Main application component
├── Data.js             # File management and display
├── Header.js           # Header component
├── Sidebar.js          # Sidebar navigation
├── SignIn.jsx          # Authentication component
├── PrivateRoute.jsx    # Route protection
├── Trash.js            # Trash/deleted files view
├── firebase.js         # Firebase configuration
├── cors.json           # CORS configuration
├── index.js            # Entry point
├── index.css           # Global styles
└── css/                # Component-specific styles
    ├── auth.css
    ├── data.css
    ├── header.css
    └── sidebar.css
```

## Technologies Used

- **React** - UI library
- **Firebase** - Backend and authentication
- **Material UI** - UI components and icons
- **React Router** - Client-side routing

## License

This project is licensed under the MIT License.
