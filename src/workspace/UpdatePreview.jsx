import React, { useState } from 'react';
import DesktopUpdates from './DesktopUpdates';
import WorkspaceAuth from './WorkspaceAuth';
import releaseInfo from './releaseInfo.json';
import { createUpdateController } from './updateController.mjs';
export default function UpdatePreview() {
  const [client] = useState(() => {
    const required = new URLSearchParams(location.search).get('workspace-update-preview') === 'required';
    const update = { version:releaseInfo.nativeVersion,body:`Workspace ${releaseInfo.version} ${releaseInfo.codename}`,rawJson:{mandatory:true,minimumNativeVersion:releaseInfo.nativeVersion},
      close:async()=>{},download:async notify=>{notify({event:'Started',data:{contentLength:100}});notify({event:'Progress',data:{chunkLength:100}});},install:async()=>{} };
    return createUpdateController({check:async()=>required?update:null,currentVersion:async()=>required?'0.1.401':releaseInfo.nativeVersion,relaunch:async()=>{}});
  });
  return <DesktopUpdates client={client}><WorkspaceAuth /></DesktopUpdates>;
}
