import React, { useState, useEffect } from 'react';
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
          auth.login(data.userId);
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
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!auth.isAuthenticated || !auth.userId) return;
      
      setLoadingProfile(true);
      try {
        const response = await fetch(`http://localhost:5000/api/profile/${auth.userId}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data.user);
        } else {
          console.error('Failed to fetch profile');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [auth.isAuthenticated, auth.userId]);

  if (auth.isAuthenticated) {
    const displayName = userProfile?.profile?.display_name || `User ${auth.userId?.substring(0, 8)}`;
    const avatarInitial = displayName.charAt(0).toUpperCase();

    return (
      <div className="App">
        <div className="profile-container">
          <div className="profile-card">
            <div className="profile-left">
              <div className="profile-pic">
                <div className="avatar">
                  {avatarInitial}
                </div>
              </div>
            </div>

            <div className="profile-right">
              <div className="profile-header">
                <h2 className="username">{displayName}</h2>
                <div className="online-status">
                  <span className="status-dot online"></span>
                  <span className="status-text">Online</span>
                </div>
              </div>

              <button className="logout-btn" onClick={auth.logout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <AuthForm isLogin={isLoginView} auth={auth} />
      <p className="auth-toggle">
        {isLoginView ? "Need an account?" : "Already have an account?"}
        <button 
          className="toggle-btn" 
          onClick={() => setIsLoginView(!isLoginView)}
        >
          {isLoginView ? "Register Here" : "Login Here"}
        </button>
      </p>
    </div>
  );
}

export default App;