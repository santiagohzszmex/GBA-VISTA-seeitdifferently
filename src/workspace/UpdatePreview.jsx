import React, { useState } from 'react';
import DesktopUpdates from './DesktopUpdates';
import WorkspaceAuth from './WorkspaceAuth';
import { createUpdateController } from './updateController.mjs';
export default function UpdatePreview() {
  const [client] = useState(() => {
    const required = new URLSearchParams(location.search).get('workspace-update-preview') === 'required';
    const update = { version:'0.1.401',body:'Actualización de acceso · Workspace 0.1.4.1',rawJson:{mandatory:true,minimumNativeVersion:'0.1.401'},
      close:async()=>{},download:async notify=>{notify({event:'Started',data:{contentLength:100}});notify({event:'Progress',data:{chunkLength:100}});},install:async()=>{} };
    return createUpdateController({check:async()=>required?update:null,currentVersion:async()=>required?'0.1.4':'0.1.401',relaunch:async()=>{}});
  });
  return <DesktopUpdates client={client}><WorkspaceAuth /></DesktopUpdates>;
}
