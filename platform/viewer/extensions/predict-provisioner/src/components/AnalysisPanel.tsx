import * as React from 'react';
import { io, Socket } from 'socket.io-client';

import PredictionAnalysisPanelSection from './PredictionAnalysisPanelSection';
import ModelRelationPanelSection from './ModelRelationPanelSection';

export type AnalysisPanelEvaluationMap = Map<SegmentationUIDPair, SegmentationPairEvaulation>;
export type SegmentationUIDPair = [string, string];
export type SegmentationPairEvaulation = { label: string; value: number }[];

export interface AnalysisPanelStatus {
  uploading: boolean;
  deleting: boolean;
  predicting: boolean;
  authenticating: boolean;
  loading: boolean;
  calculating: boolean;
}

interface AnalysisPanelProperties {
  servicesManager: any;
  commandsManager: any;
  extensionManager: any;
}

export default (properties: AnalysisPanelProperties) => {
  const { servicesManager, commandsManager, extensionManager } = properties;
  const { uiNotificationService } = servicesManager.services;

  const [socket, setSocket] = React.useState<Socket | undefined>(undefined);
  const [evaluation, setEvaluation] = React.useState<AnalysisPanelEvaluationMap>(new Map());
  const [status, setStatus] = React.useState<AnalysisPanelStatus>({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
    loading: false,
    calculating: false,
  });

  React.useEffect(() => {
    const socket = io({ path: '/api/socket.io' });

    socket.on('toast_message', ({ type, message }) => {
      uiNotificationService.show({
        title: 'Status Update',
        message,
        type,
        duration: 10000,
      });
    });

    socket.onAny((e, a) => console.log(e, a));
    setSocket(socket);

    return () => {
      socket.disconnect();
      setSocket(undefined);
    };
  }, []);

  return (
    <div className="ohif-scrollbar invisible-scrollbar overflow-auto">
      <ModelRelationPanelSection
        status={status}
        setStatus={setStatus}
        socket={socket}
        servicesManager={servicesManager}
      />

      <PredictionAnalysisPanelSection
        status={status}
        setStatus={setStatus}
        evaluation={evaluation}
        setEvaluation={setEvaluation}
        servicesManager={servicesManager}
      />
    </div>
  );
};
