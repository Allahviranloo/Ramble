// App.jsx (in client/src)
import React, { useState } from 'react';
import { useAuth } from './useAuth.jsx'; 
import './App.css'; 

const AuthForm = ({ isLogin, auth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const endpoint = isLogin ? 'login' : 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    const body = { email, password };
    if (!isLogin) body.display_name = displayName;

    try {
      const response = await fetch(`http://localhost:5000/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Success! ${data.message}`);
        if (isLogin) {
          auth.login(data.userId, data.token);
        }
      } else {
        setMessage(`${isLogin ? 'Login' : 'Registration'} Failed: ${data.error}`);
      }
    } catch (error) {
      setMessage('Network or server connection error.');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>{isLogin ? 'Ramble' : 'Create Account'}</h2>
      <div>
        <label>Email:</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label>Password:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {!isLogin && (
        <div>
          <label>Display Name:</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
      )}
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : isLogin ? 'Log In' : 'Sign Up'}
      </button>
      {message && <p className={message.startsWith('Success') ? 'success' : 'error'}>{message}</p>}
    </form>
  );
};

function App() {
  const auth = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);

  if (auth.isAuthenticated) {
    return (
      <div className="App">
        <h1>Welcome back, User {auth.userId.substring(0, 8)}...</h1>
        <p>You are logged in and your token is: **{auth.token.substring(0, 15)}...**</p>
        <button onClick={auth.logout}>Log Out</button>
      </div>
    );
  }

  return (
    <div className="App">
      <AuthForm isLogin={isLoginView} auth={auth} />
      <p>
        {isLoginView ? "Need an account?" : "Already have an account?"}
        <button onClick={() => setIsLoginView(!isLoginView)}>
          {isLoginView ? "Register Here" : "Login Here"}
        </button>
      </p>
    </div>
  );
}

export default App;