import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider, useAuth } from '../context/AuthContext';
import WorkspaceAuth from './WorkspaceAuth';
import Workspace from '../views/Workspace';
import { LicenseGate } from './LicensePanel';
import DesktopUpdates from './DesktopUpdates';
import '../index.css';
import './workspace.css';
function WorkspaceClient(){const {user}=useAuth();if(import.meta.env.DEV&&new URLSearchParams(location.search).get('workspace-preview')==='1')return <Workspace previewMode/>;if(!user)return <WorkspaceAuth/>;return <LicenseGate><Workspace/></LicenseGate>;}
const DevelopmentFrame=import.meta.env.DEV&&new URLSearchParams(location.search).get('lapis-preview')==='1'?React.Fragment:DesktopUpdates;
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><DevelopmentFrame><AuthProvider productName="Workspace"><WorkspaceClient/></AuthProvider></DevelopmentFrame></React.StrictMode>);
