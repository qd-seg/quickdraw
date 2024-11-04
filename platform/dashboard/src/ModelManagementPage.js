import React, { useState } from 'react';
import FirestoreData from './Components/FirestoreData';
import { auth } from './Components/FirestoreData';
import ModelUpload from './Components/ModelUpload';
import HelpPopup from './Components/HelpPopup';
import { useUserValue } from './UserContext';
import { useNavigate } from 'react-router-dom';

function ModelManagementPage() {
  const { user, setUser } = useUserValue();
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();

  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  const signOut = async () => {
    await auth.signOut();
    setUser('');
    navigate('/');
  };

  return (
    <div className="web-page-default">
      <div
        className="header"
        style={{ justifyContent: 'space-between', alignItems: 'center', paddingInline: '60px' }}
      >
        <h1 style={{ margin: 'center' }}>RadAIance Models List</h1>
        {user.length ? (
          <button id="pretty-button" style={{ marginRight: '0px' }} onClick={signOut}>
            Sign Out
          </button>
        ) : null}
      </div>
      <div className="black-bg">
        <div className="centered">
          <br></br>
          <h4>Currently Stored Models:</h4>
          <FirestoreData />
          <br></br>
          <h4>Model Management:</h4>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <ModelUpload />
            <button id="pretty-button" style={{ marginRight: '0px' }} onClick={togglePopup}>
              Help
            </button>
          </div>
          <div style={{ paddingTop: '40px' }}>
            <HelpPopup show={showPopup}>
              Welcome to the RadAIance administrator page! This webpage gives you access to
              available machine learning models which can be applied in the viewer. Below is more
              information about how to use the tools above.
              <br />
              <br />
              <b>Currently Stored Models</b> shows the name of the machine learning models currently
              stored. These models can be applied within the viewer.
              <br />
              <br />
              <b>Model Management</b> allows you to upload and remove machine learning models to the
              cloud. The names of these models will appear above.
              <ul>
                <li>
                  <b>To upload a model</b>, type the model name into the textbox and press the 'Add
                  Model' button. Then, select the file for the python machine learning model
                  (.[extension]???). The model name will appear above when it is successfully
                  uploaded.
                </li>
                <li>
                  <b>To remove a model</b>, type the model name you would like to delete into the
                  textbox and press the 'Remove Model' button. The model name will be removed from
                  the list when it is successfully removed
                </li>
              </ul>
            </HelpPopup>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelManagementPage;
