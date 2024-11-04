// Import necessary libraries
import React, { useState, useEffect } from 'react';
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

function FirestoreData() {
  const [documentNames, setDocumentNames] = useState<string[]>([]);
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

  return (
    <table className="models-table">
      <tbody>
        {documentNames.map((docName, index) => (
          <tr key={index}>
            <td>{docName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default FirestoreData;
