import React, { useContext, useRef, useState } from 'react';
import { Button, Col, Container, Form, Navbar, Row } from 'react-bootstrap';
import { auth } from './Components/FirestoreData';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './App.css';
import { useUserValue } from './UserContext';

function LoginPage() {
  const { user, setUser } = useUserValue();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const signIn = async () => {
    try {
      await signInWithEmailAndPassword(auth, emailRef.current!.value, passwordRef.current!.value)
        .then(() => {
          setUser('signed in');
          setError('');
          navigate('/manage');
        })
        .catch(() => {
          setError('Failed to Sign In');
        });
    } catch (error) {
      console.log(error);
      setError('Failed to Sign In');
    }
  };

  return (
    <div className="black-bg web-page-default">
      <div className="header">
        <h1>Administrator Login</h1>
      </div>

      {!user.length ? (
        <Container className="centered d-flex justify-content-center align-items-center">
          <Form className="centered" style={{ width: '100%' }}>
            <Form.Group controlId="formEmail">
              <Row>
                <Col md={3}>
                  <Form.Label style={{ color: 'white' }}>Username:</Form.Label>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Control ref={emailRef} type="email" />
                </Col>
              </Row>
            </Form.Group>
            <br></br>
            <Form.Group controlId="formPassword">
              <Row>
                <Col md={3}>
                  <Form.Label style={{ color: 'white' }}>Password:</Form.Label>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Control ref={passwordRef} type="password" />
                </Col>
              </Row>
            </Form.Group>
            <br></br>
            <Col xs={{ span: 10 }}>
              <div
                style={{
                  justifyContent: 'space-between',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Button onClick={signIn} type="button" variant="secondary">
                  Sign In
                </Button>
                {error.length ? (
                  <p
                    style={{
                      color: 'white',
                      marginBottom: '0',
                    }}
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </Col>
          </Form>
        </Container>
      ) : (
        <h2 className="mt-4 text-center">Welcome user</h2>
      )}
    </div>
  );
}

export default LoginPage;
