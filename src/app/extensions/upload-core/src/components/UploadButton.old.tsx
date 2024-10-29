import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button, PanelSection } from '@ohif/ui';

import io from 'socket.io-client';

import 'firebase/compat/firestore';
import firebase from 'firebase/compat/app';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import ProgressBar from './ProgressBar';

//Initialize Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyD0yNWUbSlUgoptXKtckdiq7hziwwjU7lo',
  authDomain: 'radiology-b0759.firebaseapp.com',
  projectId: 'radiology-b0759',
  storageBucket: 'radiology-b0759.appspot.com',
  messagingSenderId: '777622840890',
  appId: '1:777622840890:web:220613ba362f8e9f5d7703',
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export firestore database
// It will be imported into your react app whenever it is needed
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

function UploadButtonComponent() {
  const [statusMessage, setStatusMessage] = useState('');
  const [progress_percentage, setProgress_percentage] = useState(0);
  const [containersList, setContainersList] = useState([]); // [containerName, isActive
  const [counter, setCounter] = React.useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [operationStatus, setOperationStatus] = useState({
    uploading: false,
    deleting: false,
    predicting: false,
    authenticating: false,
  });

  interface Document {
    id: string;
    dateUploaded?: firebase.firestore.Timestamp;
    Description?: string;
    [key: string]: any; // for any other fields
  }

  const incrementCounter = () => {
    setCounter(counter + 1);
  };

  useEffect(() => {
    const socket = io();

    socket.on('status_update', data => {
      console.log('Status update:', data.message);
      setStatusMessage(data.message); // Update the status message based on the event
    });

    socket.on('progress_update', data => {
      console.log('Progress update:', data.value);
      // convert to num from string
      const num = Number(data.value);
      setProgress_percentage(num); // Update the progress percentage based on the event
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    //do a fetch request to see if user was authenticated
    const authenticateUser = async () => {
      setOperationStatus({ ...operationStatus, authenticating: true });
      try {
        const response = await fetch('/authenticateUser', {
          method: 'POST',
        });
      } catch (error) {
        setStatusMessage('Error on authentication');
        console.error('Error:', error);
      } finally {
        setOperationStatus({ ...operationStatus, authenticating: false });
      }
    };

    authenticateUser();
  }, []);

  useEffect(() => {
    const checkInstance = async () => {
      try {
        const response = await fetch('/checkInstance', {
          method: 'POST',
        });
      } catch (error) {
        setStatusMessage('Error on authentication');
        console.error('Error:', error);
      }
    };

    checkInstance();
  }, []);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const response = await fetch('/instancesrunning', {
        method: 'POST',
      });
      const data = await response.json();
      setContainersList(data.containers); // Assuming the backend structure is {containers: [...] }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const isAnyOperationActive = () =>
    operationStatus.uploading ||
    operationStatus.deleting ||
    operationStatus.predicting ||
    operationStatus.authenticating;

  const uploadInstance = async () => {
    setOperationStatus({ ...operationStatus, uploading: true });
    console.log('Upload button clicked');
    const url = new URL(window.location.href);
    const studyInstanceUIDsParam = url.searchParams.get('StudyInstanceUIDs');
    const firstUID = studyInstanceUIDsParam.split(/[^\d.]+/)[0];

    try {
      const response = await fetch('/uploadToVM', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstUID }),
      });

      const data = await response.text();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setOperationStatus({ ...operationStatus, uploading: false });
      fetchContainers();
    }
  };

  const runPrediction = async () => {
    setOperationStatus({ ...operationStatus, predicting: true });
    try {
      const response = await fetch('/runPrediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedModel: selectedModel }),
      });

      const data = await response.text();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setOperationStatus({ ...operationStatus, deleting: false });
      incrementCounter();
    }
  };
  const deleteInstance = async () => {
    setOperationStatus({ ...operationStatus, deleting: true });
    console.log('Deleting Instance from google cloud.');
    try {
      const response = await fetch('/deleteInstance', {
        method: 'POST',
      });

      const data = await response.text();
      console.log(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setOperationStatus({ ...operationStatus, deleting: false });
      fetchContainers();
    }
  };

  const routeChange = () => {
    let url = 'https://vaccine.cs.umd.edu/admin-login';
    window.open(url, '_blank');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const collectionRef = firebase.firestore().collection('Models');
        console.log(collectionRef);
        const snapshot = await collectionRef.get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Use doc.id to get the document name and doc.data() to get the document fields
        setDocuments(docs);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleModelSelect = docName => {
    setSelectedModel(docName);
  };

  const { t } = useTranslation();

  const radioGroupStyle = {
    borderRadius: '5px',
    marginBottom: '10px',
  };

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

  return (
    <div style={{ margin: '2px' }}>
      <div className="w-full text-center text-white">
        <h1 className="text-common-light mr-3 text-lg">Administrative Page:</h1>

        <Routes>
          <Route
            exact
            path="/"
            element={<Button onClick={routeChange}>Model Management Page</Button>}
          />
        </Routes>

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
            disabled={isAnyOperationActive()}
          />

          <br />
          <Button
            onClick={runPrediction}
            children={operationStatus.deleting ? 'Running Prediction...' : 'Run Prediction'}
            disabled={isAnyOperationActive()}
          />

          <br />
          <Button
            onClick={deleteInstance}
            children={operationStatus.deleting ? 'Deleting...' : 'Delete Current Instance'}
            disabled={isAnyOperationActive()}
          />

          <br />
          <Button
            onClick={() => console.log('Save Modified Mask clicked')}
            children={operationStatus.uploading ? 'Saving...' : 'Save Modified Mask'}
            disabled={isAnyOperationActive()}
          />

          {/* <Button
                    onClick={fetchContainers}
                    children="Refresh Containers"
                    disabled={isAnyOperationActive()}
                /> */}

          {progress > 0 && <ProgressBar color="#5acce6" progress={progress} height={30} />}

          <div style={{ color: '#90cdf4', margin: '5px' }}>
            <p>{statusMessage}</p>
          </div>
        </div>
      </PanelSection>

      <br />
      <div className="w-full text-center text-white">
        <PanelSection title={t('Models')}>
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
                      onChange={() => handleModelSelect(doc.id)}
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
      {/* Dynamically Generated Container Section for Running Containers */}
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
            {containersList &&
              containersList.map(([containerName, isActive], index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px',
                    backgroundColor: isActive ? '#68d391' : '#e2e8f0', // Highlight the active container
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
}

export default UploadButtonComponent;
