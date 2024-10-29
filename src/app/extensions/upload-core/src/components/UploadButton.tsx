import * as React from 'react';

import { Button, PanelSection, ProgressLoadingBar } from '@ohif/ui';

const UploadButton = () => {
  const [statusMessage, setStatusMessage] = React.useState('');
  const [progress, setProgress] = React.useState(0);
  const [counter, setCounter] = React.useState(0);
  const [containers, setContainers] = React.useState<[string, boolean][]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [selectedModel, setSelectedModel] = React.useState(undefined);
  const [operationStatus, setOperationStatus] = React.useState({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
  });

  const isOperationActive = () =>
    operationStatus.uploading ||
    operationStatus.deleting ||
    operationStatus.predicting ||
    operationStatus.authenticating;

  const navigateToDashboard = () => window.open('/dashboard', '_blank');

  /* TODO: */
  const uploadInstance = () => {};
  const deleteInstance = () => {};
  const fetchContainers = () => {};
  const runPrediction = () => {};

  return (
    <div style={{ margin: '2px' }}>
      <div className="w-full text-center text-white">
        <h1 className="text-common-light mr-3 text-lg">Administrative Page:</h1>
        <Button onClick={navigateToDashboard}>Model Management Page</Button>
        <br />
        <br />
      </div>

      <PanelSection title="Prediction Panel">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'left',
            justifyContent: 'center',
            fontSize: '13px',
            margin: '5px',
          }}
        >
          <br />
          <Button
            onClick={uploadInstance}
            children={operationStatus.uploading ? 'Uploading...' : 'Upload Images to Server'}
            disabled={isOperationActive()}
          />

          <br />
          <Button
            onClick={runPrediction}
            children={operationStatus.deleting ? 'Running Prediction...' : 'Run Prediction'}
            disabled={isOperationActive()}
          />

          <br />
          <Button
            onClick={deleteInstance}
            children={operationStatus.deleting ? 'Deleting...' : 'Delete Current Instance'}
            disabled={isOperationActive()}
          />

          <br />
          <Button
            onClick={() => {}}
            children={operationStatus.uploading ? 'Saving...' : 'Save Modified Mask'}
            disabled={isOperationActive()}
          />

          <br />
          <Button
            onClick={fetchContainers}
            children="Refresh Containers"
            disabled={isOperationActive()}
          />

          {progress > 0 && <ProgressLoadingBar progress={progress} />}

          <div style={{ color: '#90cdf4', margin: '5px' }}>
            <p>{statusMessage}</p>
          </div>
        </div>
      </PanelSection>
    </div>
  );
};

export default UploadButton;
