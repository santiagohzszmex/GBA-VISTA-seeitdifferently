import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from '../context/AuthContext';
import VISTAAuth from '../VISTAAuth';
import Workspace from '../views/Workspace';
import { LicenseGate } from './LicensePanel';
import DesktopUpdates from './DesktopUpdates';
import '../index.css';
import './workspace.css';
function WorkspaceClient(){const {user}=useAuth();if(!user)return <VISTAAuth onLogin={()=>{}}/>;return <LicenseGate><Workspace/></LicenseGate>;}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><DesktopUpdates/><AuthProvider><WorkspaceClient/></AuthProvider></React.StrictMode>);
