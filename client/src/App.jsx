import React, { useState, useEffect } from 'react';
import { useAuth } from './useAuth.jsx'; 
import './App.css'; 
import logo from './ramble_logo.jpg'
import searchIcon from './search_logo.png'

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
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Success! ${data.message}`);
        auth.login(data.userId, data.token);
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
      {isLogin ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img 
          src={logo} 
          style={{ width: '250px', height: '250' }}
        />
      </div>) : (<h2 style={{ color: 'white' }}>Create Account</h2>)}
      <div>
        <label style={{ color: 'white' }}>Email:</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label style={{ color: 'white' }}>Password:</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {!isLogin && (
        <div>
          <label style={{ color: 'white' }}>Display Name:</label>
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

const EditProfileModal = ({userProfile, onClose, onSave}) => {
  const [displayName, setDisplayName] = useState(userProfile?.profile?.display_name || '');
  const [bio, setBio] = useState(userProfile?.profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/editprofile', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({display_name: displayName, bio: bio}), 
        credentials: 'include'
      });

      const data = await response.json();

      if(response.ok)
      {
        setMessage('Profile successfully updated!');
        onSave(); 
        setTimeout(() => onClose(), 1500);
      } 
      else 
      {
        setMessage(`Error: ${data.error}`);
      }
    } catch(error) {
      setMessage(`Network error: ${error.message}`);
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
      <div style={{backgroundColor: 'white', padding: '30px', borderRadius: '10px', width: '400px', maxWidth: '90%'}}>
        <h2 style={{ marginTop: 0 }}>Edit Profile</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#000000ff' }}>
            Display Name:
          </label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}/>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', color: '#333' }}>
            Bio:
          </label>
          <textarea 
            value={bio}  onChange={(e) => setBio(e.target.value)} rows="4" style={{width: '100%',  padding: '8px',  resize: 'vertical', backgroundColor: '#ffffff', color: '#333', border: '1px solid #ddd', borderRadius: '5px', fontFamily: 'inherit'}}/>
        </div>

        {message && (
          <p style={{ 
            color: message.includes('Error') || message.includes('error') ? '#f44336' : '#4CAF50',
            marginBottom: '15px' 
          }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSave} disabled={saving} style={{flex: 1, padding: '10px', backgroundColor: '#b33e3e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} style={{flex: 1, padding: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SearchModal = ({onClose, currentUserId, onUserClick}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async() => {
    if(searchQuery.trim().length == 0) {
      setMessage('Please enter a search term');
      return;
    }

    setSearching(true);
    setMessage('');

    try {
      const response = await fetch(
        `http://localhost:5000/api/search/users?query=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      );

      const data = await response.json();

      if (response.ok) {
        setSearchResults(data.users);
        if (data.users.length === 0) {
          setMessage('No users found');
        }
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Network error');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleFollow = async (userId, isFollowing) => {
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`http://localhost:5000/api/follow/${userId}`, {
        method: method,
        credentials: 'include'
      });

      if (response.ok) {
        handleSearch();
      } else {
        const data = await response.json();
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Network error');
      console.error(error);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '10px',
        width: '500px',
        maxWidth: '90%',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h2 style={{ marginTop: 0 }}>Search Users</h2>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="Search by display name..."
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '5px'}}
          />
          <button onClick={handleSearch} disabled={searching} style={{padding: '10px 20px', backgroundColor: '#b33e3e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {message && (
          <p style={{color: message.includes('Error') || message.includes('error') ? '#f44336' : '#666', marginBottom: '15px', textAlign: 'center'}}>
            {message}
          </p>
        )}

        <div style={{flex: 1,  overflowY: 'auto', marginBottom: '15px'}}>
          {searchResults.map(user => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #eee', cursor: 'pointer'}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #db2e2e 0%, #312f32 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold'}}>
                  {user.display_name[0].toUpperCase()}
                </div>
                <span style={{ fontSize: '1rem', color: '#333' }}>
                  {user.display_name}
                </span>
              </div>
              <button onClick={() => handleFollow(user.id, user.is_following)} style={{ padding: '8px 20px', backgroundColor: user.is_following ? '#666' : '#b33e3e', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem'}}>
                {user.is_following ? 'Unfollow' : 'Follow'}
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={onClose}
          style={{ padding: '10px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          Close
        </button>
      </div>
    </div>
  );
};

function App() {
  const auth = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const fetchUserProfile = async () => {
    if (!auth.isAuthenticated || !auth.userId) return;
    
    setLoadingProfile(true);
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${auth.userId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("Received Profile Data:", data.user);
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

  useEffect(() => {
    fetchUserProfile();
  }, [auth.isAuthenticated, auth.userId]);

  if (auth.isAuthenticated) {
    const displayName = userProfile?.profile?.display_name || `${auth.userId?.substring(0, 5)}`;
    const userBio = userProfile?.profile?.bio || 'No biography yet.';
    const followerCount = userProfile?.profile?.followers_count || 0;
    const followingCount = userProfile?.profile?.following_count || 0;

    return (
      <div className="App">
        {showEditModal && (
          <EditProfileModal 
            userProfile={userProfile}
            onClose={() => setShowEditModal(false)}
            onSave={fetchUserProfile} 
          />
        )}

        {showSearchModal && (
          <SearchModal 
            onClose={() => {
              setShowSearchModal(false);
              fetchUserProfile();
            }}
            currentUserId={auth.userId}
          />
        )}

        <div className="profile-container">
          <div className="profile-card">
              <div className="profile-pic">
                <div className="avatar"></div>
                
                <h2 className="username" style={{marginLeft: '4px'}}>{displayName}
                  <div className="online-status">
                    <span className="status-dot online"></span>
                    <span className="status-text">Online</span>
                  </div>
                </h2>

                <div style={{marginTop: '10px', marginLeft: '15px', textAlign: 'center'}}>
                  <div style={{color: 'gray', fontWeight: 'bold'}}>
                    {followerCount}
                  </div>
                  <label style={{fontWeight: 'bold', color: 'gray'}}>
                    Followers
                  </label>
                </div>

                <div style={{marginTop: '10px', textAlign: 'center'}}>
                  <div style={{color: 'gray', fontWeight: 'bold'}}>
                    {followingCount}
                  </div>
                  <label style={{fontWeight: 'bold', color: 'gray'}}>
                    Following
                  </label>
                </div>

                <button onClick={() => setShowSearchModal(true)} style={{marginBottom:'30px', marginLeft:'980px', background:'white', fontSize: '2rem' }}>
                🔍
                </button>
              </div>
              <p style={{ color: '#666', textAlign: 'left', marginTop: '10px', maxWidth: '180px'}}>
                {userBio}
              </p>

              <button className="edit-btn" onClick={() => setShowEditModal(true)} style={{marginLeft:'15px'}}>
                Edit Profile
              </button>

              <button className="logout-btn" onClick={auth.logout}>
                Log Out
              </button>
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