import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { ProgressLoadingBar, Toolbox } from '@ohif/ui';

import ModelRelationPanelSection from './ModelRelationPanelSection';
import PredictionAnalysisPanelSection from './PredictionAnalysisPanelSection';
import AdaptedSegmentationPanelSection from './AdaptedSegmentationPanelSection';

export interface PanelStatus {
    uploading: boolean;
    deleting: boolean;
    predicting: boolean;
    authenticating: boolean;
    loading: boolean;
    calculating: boolean;
};

export default ({ servicesManager, commandsManager, extensionManager }) => {
  const [analysis, setAnalysis] = React.useState<Record<string, any>>({});
//   const [progress, setProgress] = React.useState<number | undefined>(0);
  const [status, setStatus] = React.useState<PanelStatus>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  const [socket, setSocket] = React.useState<Socket | undefined>(undefined);

  const isProcessing = () => !Object.values(status).every(x => x === false);

//   React.useEffect(() => {
//     isProcessing() ? setProgress(undefined) : setProgress(0);
//   }, [status]);

  React.useEffect(() => {
    const { uiNotificationService } = servicesManager.services;

    const socket = io({ path: '/api/socket.io' });

    socket.on('toast_message', ({ type, message }) => {
      uiNotificationService.show({
        title: 'Status Update',
        message,
        type,
        duration: 10000,
      });
    });

    socket.onAny((event, a) => {
        console.log(event, a)
    });

    // socket.on('progress_update', ({ value }) => {
    //   if (isProcessing()) setProgress(parseFloat(value) || 0);
    // });

    setSocket(socket);

    return () => {
      console.log('Diconnecting socket.')
      socket.disconnect();
      setSocket(undefined);
    };
  }, []);

  return (
    <div className="ohif-scrollbar invisible-scrollbar overflow-auto">
      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
        socket={socket}
      />

      <PredictionAnalysisPanelSection
        status={status}
        setStatus={setStatus}
        setAnalysis={setAnalysis}
        servicesManager={servicesManager}
      />

      <Toolbox
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
        buttonSectionId="segmentationToolbox"
        title="Segmentation Tools"
      />

      <AdaptedSegmentationPanelSection
        analysis={analysis}
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
      />
    </div>
  );
};
