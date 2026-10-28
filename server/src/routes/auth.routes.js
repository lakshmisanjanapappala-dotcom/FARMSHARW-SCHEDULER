import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { memoryDb, isLiveSupabase, supabasePublic } from '../config/supabase.js';
import { AppError } from '../middleware/error-handler.js';
import { authRateLimiter } from '../middleware/rate-limit.js';

const router = Router();

// GET /api/me - Retrieve currently authenticated user context
router.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        phone: req.user.phone,
        roles: req.user.roles,
        profile: req.user.profile
      }
    }
  });
});

// GET /api/me/profile - Full profile details
router.get('/me/profile', authenticate, (req, res) => {
  const profile = memoryDb.tables.profiles.find(p => p.id === req.user.id) || req.user.profile;
  const verification = memoryDb.tables.user_verifications.filter(v => v.user_id === req.user.id).slice(-1)[0] || null;

  res.json({
    success: true,
    data: {
      profile,
      roles: req.user.roles,
      verificationStatus: verification ? verification.status : 'unverified'
    }
  });
});

// PATCH /api/me/profile - Update user profile
router.patch('/me/profile', authenticate, (req, res) => {
  let profile = memoryDb.tables.profiles.find(p => p.id === req.user.id);
  if (!profile) {
    profile = { id: req.user.id, full_name: 'Farmer', created_at: new Date().toISOString() };
    memoryDb.tables.profiles.push(profile);
  }

  const { fullName, phone, bio, preferredLanguage, state, district, villageOrTown, pinCode } = req.body;
  if (fullName) profile.full_name = fullName;
  if (phone) profile.phone_number = phone;
  if (bio !== undefined) profile.bio = bio;
  if (preferredLanguage) profile.preferred_language = preferredLanguage;
  if (state) profile.state = state;
  if (district) profile.district = district;
  if (villageOrTown) profile.village_or_town = villageOrTown;
  if (pinCode) profile.pin_code = pinCode;
  profile.updated_at = new Date().toISOString();

  res.json({
    success: true,
    data: { profile }
  });
});

// POST /api/me/verification-requests - Submit Kisan KYC document
router.post('/me/verification-requests', authenticate, (req, res, next) => {
  try {
    const { idType, idNumberMasked, documentFilePath } = req.body;
    if (!idType || !idNumberMasked) {
      throw new AppError('idType and idNumberMasked are required', 400, 'INVALID_VERIFICATION_PAYLOAD');
    }

    const verificationRecord = {
      id: 'v-' + Date.now(),
      user_id: req.user.id,
      id_type: idType,
      id_number_masked: idNumberMasked,
      // Ensure file path conforms to Supabase Storage RLS folder structure: {userId}/{filename}
      document_file_path: documentFilePath
        ? (documentFilePath.startsWith(`${req.user.id}/`) ? documentFilePath : `${req.user.id}/${documentFilePath}`)
        : `${req.user.id}/kyc-doc-placeholder.jpg`,
      status: 'pending',
      reviewer_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    memoryDb.tables.user_verifications.push(verificationRecord);

    res.status(201).json({
      success: true,
      data: { verification: verificationRecord }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/phone/otp - Send phone OTP
router.post('/auth/phone/otp', authRateLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.match(/^\+91[6-9]\d{9}$/)) {
      throw new AppError('A valid Indian mobile number in E.164 format (+91XXXXXXXXXX) is required', 400, 'INVALID_PHONE_NUMBER');
    }

    // In live Supabase mode: call supabasePublic.auth.signInWithOtp
    if (isLiveSupabase) {
      const { error } = await supabasePublic.auth.signInWithOtp({ phone });
      if (error) throw new AppError(error.message, 400, 'OTP_DISPATCH_FAILED');
    }

    res.json({
      success: true,
      data: {
        message: `OTP sent successfully to ${phone}. (For local testing/sandbox, enter code: 123456)`,
        phone,
        expiresInSeconds: 300
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/phone/verify - Verify phone OTP
router.post('/auth/phone/verify', authRateLimiter, async (req, res, next) => {
  try {
    const { phone, token } = req.body;
    if (!phone || !token) {
      throw new AppError('Phone and 6-digit OTP token are required', 400, 'MISSING_OTP_PARAMS');
    }

    // Sandbox / dev OTP check
    if (token === '123456') {
      let user = memoryDb.tables.profiles.find(p => p.phone_number === phone);
      if (!user) {
        user = {
          id: 'u-' + Date.now(),
          full_name: 'Kisan User',
          phone_number: phone,
          phone_verified: true,
          email: `${phone.replace('+', '')}@farmsharw.local`,
          preferred_language: 'en',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        memoryDb.tables.profiles.push(user);
        memoryDb.tables.user_roles.push({ id: 'r-' + Date.now(), user_id: user.id, role: 'renter' });
      }

      return res.json({
        success: true,
        data: {
          session: {
            access_token: `mock-token-${user.id}`,
            token_type: 'bearer',
            expires_in: 3600,
            user: {
              id: user.id,
              phone: user.phone_number,
              email: user.email,
              user_metadata: { full_name: user.full_name }
            }
          }
        }
      });
    }

    if (isLiveSupabase) {
      const { data, error } = await supabasePublic.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
      });
      if (error) throw new AppError(error.message, 400, 'INVALID_OTP');
      return res.json({ success: true, data: { session: data.session } });
    }

    throw new AppError('Invalid OTP code. (For sandbox testing, use 123456)', 400, 'INVALID_OTP');
  } catch (err) {
    next(err);
  }
});

export default router;

