//index.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const{PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;

const app = express();

app.use(cors({origin: 'http://localhost:5173', credentials:true}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/status', (req,res) => {res.json({message:"Server running"})});

app.post('/api/register', async(req,res) => {
    const{email, password, display_name} = req.body; 

    if(!email || !password || !display_name) { 
        return res.status(400).json({error:"Please fill out all fields: display name, email, and password"});
    }

    try {
        const existingUser = await prisma.user.findUnique({where:{email}});
        if(existingUser) {
            return res.status(409).json({error:"This email\'s already linked to an account"})
        }

        const password_hash = await bcrypt.hash(password,10);

        const newUser = await prisma.user.create({
            data:{
                email, 
                password_hash, 
                profile:{
                    create:{display_name} 
                }
            }
        })

        res.status(201).json({message:"Registered Successfully!", userId:newUser.id});
    } catch(error) {
        console.error("Registration error:", error);
        res.status(500).json({error:"Server error during registration"});
    }
});

app.post('/api/login', async(req,res) => {
    const{email, password} = req.body;

    if(!email || !password) {
        return res.status(400).json({error:"Please provide both email and password"});
    }

    try {
        const user = await prisma.user.findUnique({where:{email}});
        if(!user) {
            return res.status(401).json({error:"Invalid email or password"});
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if(!passwordMatch) {
            return res.status(401).json({error:"Invalid email or password"});
        }

        const token = jwt.sign({userId:user.id}, JWT_SECRET, {expiresIn:'1h'});

        res.cookie('token', token, {httpOnly:true, secure:process.env.NODE_ENV==='production', maxAge:3600000});
        res.status(200).json({message: "Login successful!", token, userId: user.id});
    } catch(error) {
        console.error("Login error:", error);
        res.status(500).json({error:"Server error during login"});
    }
});

app.post('/api/logout', (req,res) => {
    res.clearCookie('token');
    res.status(200).json({message:"Logged out successfully"});
});

app.listen(PORT, () => {console.log(`Server listening on port ${PORT}`);});
