import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import requireAuth from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = Router();

function makeToken(userId) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || password.length < 8) {
      return res.status(400).json({ message: 'Name, valid email, and password of at least 8 characters are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });
    res.status(201).json({ token: makeToken(String(user._id)), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Incorrect email or password.' });
    }
    res.json({ token: makeToken(String(user._id)), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/google', async (req, res, next) => {
  try {
    const credential = String(req.body.credential || '');
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: 'Google sign-in is not configured on the server yet.' });
    }
    if (!credential) return res.status(400).json({ message: 'Google credential is missing.' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ message: 'Google could not verify this account email.' });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] }).select('+passwordHash');
    if (user) {
      // A verified Google email can be linked to an existing email/password account.
      if (!user.googleId) user.googleId = payload.sub;
      if (!user.name && payload.name) user.name = payload.name;
      await user.save();
    } else {
      user = await User.create({
        name: String(payload.name || email.split('@')[0]).slice(0, 80),
        email,
        googleId: payload.sub
      });
    }

    res.json({ token: makeToken(String(user._id)), user: publicUser(user) });
  } catch (error) {
    if (error?.message && /token|audience|issuer|certificate|signature/i.test(error.message)) {
      return res.status(401).json({ message: 'Google sign-in expired. Please try again.' });
    }
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

export default router;
