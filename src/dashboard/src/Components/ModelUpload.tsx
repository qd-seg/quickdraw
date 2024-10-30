// Import necessary libraries
import React, { useState } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

function ModelUpload() {
  const [modelName, setModelName] = useState('');

  const addModel = () => {
    const dateUploaded = firebase.firestore.Timestamp.now();

    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';

    if (modelName.trim() == '') {
      alert('Please enter a model name.');
      return;
    }

    // Listen for the change event, so we can get the selected file
    fileInput.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files![0];

      // typecheck file here
      // if (file.type !== 'text/x-python') {
      //   alert('Please upload a Python (.py) file.');
      //   return;
      // }

      const reader = new FileReader();

      reader.onloadend = e => {
        const fileData = (e.target as FileReader).result;

        // Log the file data to the console
        console.log('modelName: ' + modelName);
        console.log('fileData: ' + fileData);

        // Now you can use fileData to upload the file to Firestore
        firebase
          .firestore()
          .collection('Models')
          .doc(modelName)
          .set({
            dateUploaded,
          })
          .then(() => {
            // Refresh the page a few seconds after the upload is complete
            setTimeout(() => {
              window.location.reload();
            }, 1000); // Change this to the number of milliseconds you want to wait
          });
      };

      reader.readAsDataURL(file); // Or readAsArrayBuffer(file), depending on what you want to do with the file
    });

    // Trigger the file selection dialog
    fileInput.click();
  };

  const removeModel = (id: string | undefined) => {
    firebase
      .firestore()
      .collection('Models')
      .doc(id)
      .delete()
      .then(() => {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      });
  };

  return (
    <div>
      <input type="text" value={modelName} onChange={e => setModelName(e.target.value)} />
      <button id="pretty-button" onClick={addModel}>
        Add Model
      </button>
      {/* You'll need to pass the id of the document you want to remove */}
      <button id="pretty-button" onClick={() => removeModel(modelName)}>
        Remove Model
      </button>
    </div>
  );
}

export default ModelUpload;
