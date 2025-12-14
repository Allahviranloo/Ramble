-- db/init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "User" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE "Profile" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    bio TEXT,
    profile_picture_url TEXT,

    CONSTRAINT fk_profile_user
        FOREIGN KEY (user_id) 
        REFERENCES "User"(id)
        ON DELETE CASCADE
);

CREATE TABLE "Post" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL,
    caption TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_post_owner
        FOREIGN KEY (owner_id) 
        REFERENCES "User"(id)
        ON DELETE CASCADE
);

CREATE TABLE "Follow" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL,
    following_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (follower_id, following_id), 

    CONSTRAINT fk_follow_follower
        FOREIGN KEY (follower_id) 
        REFERENCES "User"(id)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_follow_following
        FOREIGN KEY (following_id) 
        REFERENCES "User"(id)
        ON DELETE CASCADE
);