import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

import { Select, Icon, Dropdown, PanelSection, Button } from '../../../platform/ui/src/components';
import App from '../../../../model-management-page/src/App';
import { useTranslation } from 'react-i18next';
import SegmentationDropDownRow from '../../../platform/ui/src/components/SegmentationGroupTable/SegmentationDropDownRow';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

const ModelDropDown: React.FC = () => {
  const [documentNames, setDocumentNames] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const routeChange = () => {
    let url = 'http://localhost:4000/';
    window.open(url, '_blank');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const collectionRef = firebase.firestore().collection('Models');
        console.log(collectionRef);
        const snapshot = await collectionRef.get();
        const docNames = snapshot.docs.map(doc => doc.id); // Use doc.id to get the document name
        setDocumentNames(docNames);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleDocSelect = docName => {
    setSelectedDoc(docName);
  };

  const { t } = useTranslation();

  return (
    <div className="w-full text-center text-white">
      <h1 className="text-common-light mr-3 text-lg">Administrative Page:</h1>
      <Routes>
        <Route
          exact
          path="/"
          element={<Button onClick={routeChange}>Model Management Page</Button>}
        />
      </Routes>
      <br></br>
      <br></br>
      <PanelSection title={t('Models')}>
        {documentNames.map((docName, index) => (
          <div key={index}>
            <label>
              <input
                type="radio"
                value={docName}
                checked={selectedDoc === docName}
                onChange={() => handleDocSelect(docName)}
              />
              {docName}
            </label>
            <br />
          </div>
        ))}
      </PanelSection>
      {selectedDoc && (
        <div>
          <h2>Selected Document:</h2>
          <p>{selectedDoc}</p>
        </div>
      )}
    </div>
  );
};

export default ModelDropDown;
