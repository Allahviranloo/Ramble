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

        res.status(200).json({ message: "Login successful!", userId: user.id });
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
                media_url,
                caption,
                created_at
            FROM "Post" 
            WHERE owner_id = $1
            ORDER BY created_at DESC
            LIMIT 20; -- Only fetch the 20 most recent posts for efficiency
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


app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
    pool.end(); 
    console.log('\nDatabase pool closed. Server shutting down.');
    process.exit(0);
});