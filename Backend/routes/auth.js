import express from 'express'
import { Pool } from 'pg'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'

dotenv.config()
const router = express.Router()

//Register a user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body; // role_id provided by client

    // Validate role exists
    const { rows: roleRows } = await pool.query(
      'SELECT * FROM roles WHERE id = $1',
      [role_id]
    );
    if (roleRows.length === 0) return res.status(400).json({ error: 'Invalid role selected' });

    // Check if user already exists
    const { rows: existing } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    if (existing.length > 0) return res.status(400).json({ error: 'User already exists' });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role_id',
      [name, email, hashed, role_id]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: rows[0].id, role_id: rows[0].role_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({ user: rows[0], token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Login
router.post('/login',async(req,res)=>{
    try{
        const {email,password}=req.body;
        //find user
        const {row}=await Pool.query('SELECT * FROM users where email=$1',[email])
        if (rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const user = rows[0];

    // Compare password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    // Generate JWT
    const token = jwt.sign({ id: user.id, role_id: user.role_id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN
    });

    res.json({ user: { id: user.id, name: user.name, email: user.email, role_id: user.role_id }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;