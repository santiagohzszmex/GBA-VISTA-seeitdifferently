import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from '../context/AuthContext';
import WorkspaceAuth from './WorkspaceAuth';
import Workspace from '../views/Workspace';
import { LicenseGate } from './LicensePanel';
import DesktopUpdates from './DesktopUpdates';
import '../index.css';
import './workspace.css';
function WorkspaceClient(){const {user}=useAuth();if(!user)return <WorkspaceAuth/>;return <LicenseGate><Workspace/></LicenseGate>;}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><DesktopUpdates/><AuthProvider productName="Workspace"><WorkspaceClient/></AuthProvider></React.StrictMode>);
