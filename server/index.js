// index.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config(); 

const { Pool } = require('pg'); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ FATAL: Error connecting to PostgreSQL database:', err.stack);
        process.exit(1);
    } else {
        console.log('✅ Connected to PostgreSQL database.');
    }
});


const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true 
}));
app.use(express.json()); 
app.use(cookieParser()); 

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: "Access denied. No authentication token provided." });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; 
        next();
    } catch (err) {
        console.error("Token verification failed:", err.message);
        res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' });
        return res.status(403).json({ error: "Invalid or expired token. Please log in again." });
    }
};

app.get('/api/status', (req, res) => {
    res.json({ message: "Server running" });
});

app.post('/api/register', async (req, res) => {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
        return res.status(400).json({ error: "Please fill out all fields." });
    }
    const connection = await pool.connect(); 
    try {
        await connection.query('BEGIN');

        const checkQuery = `SELECT id FROM "User" WHERE email = $1`;
        const existingUser = await connection.query(checkQuery, [email]);
        if (existingUser.rows.length > 0) {
            await connection.query('ROLLBACK');
            return res.status(409).json({ error: "This email is already linked to an account" });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const userQuery = `
            INSERT INTO "User" (email, password_hash, created_at) 
            VALUES ($1, $2, NOW()) 
            RETURNING id;
        `;
        const userResult = await connection.query(userQuery, [email, password_hash]);
        const userId = userResult.rows[0].id;

       
        const profileQuery = `
            INSERT INTO "Profile" (user_id, display_name) 
            VALUES ($1, $2);
        `;
        await connection.query(profileQuery, [userId, display_name]);

        await connection.query('COMMIT'); 

        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000,
            sameSite: 'Lax'
        });
        
        res.status(201).json({ message: "Registered Successfully!", userId });

    } catch (error) {
        await connection.query('ROLLBACK'); 
        console.error("Registration error:", error);
        if (error.code === '23505') { 
            return res.status(409).json({ error: "This email is already linked to an account" });
        }
        res.status(500).json({ error: "Server error during registration" });

    } finally {
        connection.release();
    }
});


app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Please provide both email and password" });
    }

    try {
        const userQuery = `SELECT id, password_hash FROM "User" WHERE email = $1`;
        const userResult = await pool.query(userQuery, [email]); 
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            maxAge: 3600000, 
            sameSite: 'Lax'
        });

        res.status(200).json({ message: "Login successful!", userId: user.id, token: token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error during login" });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax', 
    });
    res.status(200).json({ message: "Logout successful." });
});

app.put('/api/editprofile', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {display_name, bio} = req.body;

    try {
        const updateQuery = 'UPDATE "Profile" SET display_name = $1, bio = $2 WHERE user_id = $3 RETURNING *;';
        const result = await pool.query(updateQuery, [display_name, bio, userId]);

        res.status(200).json({message: "Profile successfully updated!", profile: result.rows[0]});
    } catch(error)
    {
        console.error("Error:", error);
        res.status(500).json({error: error.message});
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const query = `
            SELECT 
                u.id, 
                u.email, 
                u.created_at, 
                p.display_name
            FROM "User" u
            LEFT JOIN "Profile" p ON u.id = p.user_id
            WHERE u.id = $1`;

        const result = await pool.query(query, [userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: "User data not found." });
        }
        
        const formattedUser = {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            profile: {
                display_name: user.display_name
            }
        };

        res.json({ message: "Successfully fetched user data.", user: formattedUser });

    } catch (error) {
        console.error("Protected route fetch error:", error);
        res.status(500).json({ error: "Server error fetching user data." });
    }
});

app.get('/api/profile/:userId', authenticateToken, async (req, res) => {
    const targetUserId = req.params.userId;
    
    try {
        const profileQuery = `
            SELECT 
                u.id, 
                u.email, 
                u.created_at, 
                p.display_name,
                p.bio,
                p.profile_picture_url,
                (SELECT COUNT(*) FROM "Follow" WHERE following_id = u.id) AS followers_count,
                (SELECT COUNT(*) FROM "Follow" WHERE follower_id = u.id) AS following_count
            FROM "User" u
            LEFT JOIN "Profile" p ON u.id = p.user_id
            WHERE u.id = $1;
        `;

        const profileResult = await pool.query(profileQuery, [targetUserId]);
        const profileData = profileResult.rows[0];

        if (!profileData) {
            return res.status(404).json({ error: "User not found." });
        }

        const postsQuery = `
            SELECT 
                id,
                caption,  /* Changed from 'content' to 'caption' */
                created_at
            FROM "Post" 
            WHERE owner_id = $1
            ORDER BY created_at DESC
            LIMIT 20;
        `;
        const postsResult = await pool.query(postsQuery, [targetUserId]);
        
        const finalProfile = {
            id: profileData.id,
            email: profileData.email,
            created_at: profileData.created_at,
            profile: {
                display_name: profileData.display_name,
                bio: profileData.bio,
                profile_picture_url: profileData.profile_picture_url,
                followers_count: parseInt(profileData.followers_count), 
                following_count: parseInt(profileData.following_count), 
            },
            posts: postsResult.rows
        };

        res.json({ message: "Successfully fetched user profile.", user: finalProfile });

    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ error: "Server error fetching profile data." });
    }
});

app.get('/api/search/users', authenticateToken, async (req, res) => {
    const {query} = req.query;
    const currentUserId = req.user.userId;

    if(!query || query.trim().length == 0)
    {
        return res.status(400).json({error: "You need to search for something!"});
    }

    try {
        const searchQuery = 'SELECT u.id, p.display_name, p.profile_picture_url, EXISTS(SELECT 1 FROM "Follow" WHERE follower_id = $1 AND following_id = u.id) AS is_following FROM "User" u LEFT JOIN "Profile" p ON u.id = p.user_id WHERE LOWER(p.display_name) LIKE LOWER($2) AND u.id != $1 LIMIT 20';
        const result = await pool.query(searchQuery, [currentUserId, `%${query}%`]);

        res.json({users:result.rows});
    } catch(error) {
        console.error("Search error:", error);
        res.status(500).json({error: "Server error during search"});
    }
});

app.post('/api/follow/:userId', authenticateToken, async (req, res) => {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    if(currentUserId == targetUserId)
    {
        return res.status(400).json({error: "You can only follow other people" });
    }

    try {
        const checkQuery = 'SELECT id FROM "Follow" WHERE follower_id = $1 AND following_id = $2';
        const existing = await pool.query(checkQuery, [currentUserId, targetUserId]); 

        if(existing.rows.length > 0)
        {
            return res.status(400).json({error: "Already following this user"});
        }

        const followQuery = 'INSERT INTO "Follow" (follower_id, following_id, created_at) VALUES ($1, $2, NOW()) RETURNING *;'; 
        await pool.query(followQuery, [currentUserId, targetUserId]);

        res.status(201).json({message: "You're following this user"}); 
    } catch(error)
    {
        console.error("Follow error:", error);
        res.status(500).json({error: "Server error while following user"});
    }
});

app.delete('/api/follow/:userId', authenticateToken, async (req, res) => {
    const currentUserId = req.user.userId;
    const targetUserId = req.params.userId;

    try {
        const unfollowQuery = 'DELETE FROM "Follow" WHERE follower_id = $1 AND following_id = $2 RETURNING *;';
        const result = await pool.query(unfollowQuery, [currentUserId, targetUserId]);

        if(result.rows.length == 0)
        {
            return res.status(404).json({error: "Following relationship not found"});
        }

        res.json({message: "Unfollowed user"});
    } catch(error)
    {
        console.error("Unfollow error:", error);
        res.status(500).json({error: "Server error while unfollowing user"});
    }
});

app.post('/api/posts', authenticateToken, async (req,res) => {
    const userId = req.user.userId;
    const {caption} = req.body;

    if(!caption || caption.trim().length == 0)
    {
        return res.status(400).json({error: "You can\'t post nothing"});
    }

    try {
        const insertQuery = `
            INSERT INTO "Post" (owner_id, caption, created_at) 
            VALUES ($1, $2, NOW()) 
            RETURNING *;
        `;
        const result = await pool.query(insertQuery, [userId, caption.trim()]);

        res.status(201).json({ 
            message: "Post created successfully!", 
            post: result.rows[0] 
        });
    } catch(error) {
        console.error("Create post error:", error)
        res.status(500).json({error: "Server error when creating post"});
    }
});

app.get('/api/posts/feed', authenticateToken, async (req,res) => {
    const userId = req.user.userId;

    try {
        const feedQuery = `
            SELECT 
                p.id,
                p.owner_id,
                p.caption,
                p.created_at,
                pr.display_name
            FROM "Post" p
            JOIN "Profile" pr ON p.owner_id = pr.user_id
            WHERE p.owner_id = $1 
                OR p.owner_id IN (
                    SELECT following_id 
                    FROM "Follow" 
                    WHERE follower_id = $1
                )
            ORDER BY p.created_at DESC
            LIMIT 50;
        `;

        const result = await pool.query(feedQuery, [userId]);

        res.json({posts: result.rows});
    } catch(error) {
        console.error("Feed fetch error:", error);
        res.status(500).json({error: "Server error when fetching feed"});
    }
});

app.delete('/api/posts/:postId', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const postId = req.params.postId;

    try {
        const checkQuery = 'SELECT owner_id FROM "Post" WHERE id = $1';
        const checkResult = await pool.query(checkQuery, [postId]);

        if(checkResult.rows.length === 0)
        {
            return res.status(404).json({error: "Post not found"});
        }

        if(checkResult.rows[0].owner_id !== userId)  
        {
            return res.status(403).json({error: "You can only delete your own posts"});
        }

        const deleteQuery = 'DELETE FROM "Post" WHERE id = $1 RETURNING *';
        await pool.query(deleteQuery, [postId]);

        res.json({message: "Post deleted!"});
    } catch(error) {
        console.error("Delete post error:", error);
        res.status(500).json({error: "Server error while deleting post"});
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
    pool.end(); 
    console.log('\nDatabase pool closed. Server shutting down.');
    process.exit(0);
});