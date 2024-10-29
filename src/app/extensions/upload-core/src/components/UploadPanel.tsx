import * as React from 'react';

import { Button, PanelSection, ProgressLoadingBar } from '@ohif/ui';

import { Timestamp } from 'firebase/firestore';

interface Document {
  id: string;
  dateUploaded?: Timestamp;
  Description?: string;
  [key: string]: any;
}

const labelStyle = {
  display: 'inline-block',
  padding: '5px',
  borderRadius: '5px',
  cursor: 'pointer',
};

const checkedLabelStyle = {
  ...labelStyle,
  backgroundColor: '#0844b3',
  color: '#fff',
};

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

      <br />
      <div className="w-full text-center text-white">
        <PanelSection title={'Models'}>
          <div style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '13px' }}>
            {documents.map((doc, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  margin: '3px',
                  borderBottom: '1px solid #3a3f99',
                }}
              >
                <div
                  style={{
                    width: '70%',
                    padding: '5px',
                  }}
                >
                  <label style={selectedModel === doc.id ? checkedLabelStyle : labelStyle}>
                    <input
                      type="radio"
                      value={doc.id}
                      checked={selectedModel === doc.id}
                      onChange={() => setSelectedModel(doc.id)}
                    />
                    {doc.id}
                  </label>
                </div>
                <button
                  onClick={() => {
                    alert(
                      `Description: ${doc.description}\nDate Uploaded: ${doc.dateUploaded
                        .toDate()
                        .toLocaleDateString()}`
                    );
                  }}
                  style={{
                    backgroundColor: '#041c4a',
                    alignSelf: 'flex-end', // Align the button to the right
                    borderRadius: '3px',
                    padding: '5px',
                    color: 'lightgray',
                  }}
                >
                  Info
                </button>
              </div>
            ))}
          </div>
        </PanelSection>
        <br />
        {selectedModel && (
          <div>
            <h2>Selected Model:</h2>
            <p>{selectedModel}</p>
          </div>
        )}
      </div>

      {
        <div
          style={{
            marginTop: '1em',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <h5>Running Containers</h5>
          <div style={{ marginTop: '1em', width: '100%', textAlign: 'center' }}>
            {containers &&
              containers.map(([containerName, isActive], index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px',
                    backgroundColor: isActive ? '#68d391' : '#e2e8f0',
                    marginBottom: '5px',
                    color: 'black',
                  }}
                >
                  {isActive ? `${containerName} (Your Container)` : containerName}
                </div>
              ))}
          </div>
        </div>
      }
    </div>
  );
};

export default UploadButton;
