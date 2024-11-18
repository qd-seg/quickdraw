import * as React from 'react';
import { io } from 'socket.io-client';
import { ProgressLoadingBar, Toolbox } from '@ohif/ui';

import ModelRelationPanelSection from './ModelRelationPanelSection';
import PredictionAnalysisPanelSection from './PredictionAnalysisPanelSection';
import AdaptedSegmentationPanelSection from './AdaptedSegmentationPanelSection';

export default ({ servicesManager, commandsManager, extensionManager }) => {
  const [analysis, setAnalysis] = React.useState<Record<string, any>>({});
  const [progress, setProgress] = React.useState<number | undefined>(0);
  const [status, setStatus] = React.useState<Record<string, boolean>>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  const isProcessing = () => !Object.values(status).every(x => x === false);

  React.useEffect(() => {
    isProcessing() ? setProgress(undefined) : setProgress(0);
  }, [status]);

  React.useEffect(() => {
    const { uiNotificationService } = servicesManager.services;

    const socket = io('/api/socket.io');

    socket.on('status_update', ({ message }) => {
      uiNotificationService.show({
        title: 'Status Update',
        message,
        type: 'info',
        duration: 5000,
      });
    });

    socket.on('progress_update', ({ value }) => {
      setProgress(value);
    });

    socket.on('toast_message', ({ type, message }) => {
      uiNotificationService.show({
        title: 'Status Update',
        message,
        type,
        duration: 5000,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <ProgressLoadingBar progress={progress} />

      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        servicesManager={servicesManager}
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
