const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Generate signed JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
  });
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new institution user (institution_admin)
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, institution_id } = req.body;

    // 1. Check if email is already registered
    const existingUser = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // 2. Validate that the institution exists
    const instCheck = await query(
      'SELECT id, name, status FROM institutions WHERE id = $1',
      [institution_id]
    );

    if (instCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The specified institution does not exist.',
      });
    }

    if (instCheck.rows[0].status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Cannot register user for a suspended institution.',
      });
    }

    // 3. Hash password with bcryptjs (salt rounds: 12)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Insert user into database
    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role, institution_id, is_active)
      VALUES ($1, LOWER($2), $3, 'institution_admin', $4, true)
      RETURNING id, name, email, role, institution_id, is_active, created_at
    `;
    const result = await query(insertQuery, [
      name.trim(),
      email.trim(),
      passwordHash,
      institution_id,
    ]);

    const newUser = result.rows[0];

    // 5. Generate JWT token
    const tokenPayload = {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      institution_id: newUser.institution_id,
    };
    const token = generateToken(tokenPayload);

    return res.status(201).json({
      success: true,
      message: 'Institution administrator registered successfully.',
      data: {
        token,
        user: {
          ...newUser,
          institution_name: instCheck.rows[0].name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Fetch user by email
    const userResult = await query(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.institution_id, u.is_active,
              i.name AS institution_name, i.status AS institution_status
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = userResult.rows[0];

    // 2. Check if user account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact AICTE support.',
      });
    }

    // 3. Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Generate JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      institution_id: user.institution_id,
    };
    const token = generateToken(tokenPayload);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          institution_id: user.institution_id,
          institution_name: user.institution_name || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user's profile
 * @access  Private (authenticateToken required)
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const userQuery = `
      SELECT u.id, u.name, u.email, u.role, u.institution_id, u.is_active, u.created_at,
             i.name AS institution_name, i.aicte_code, i.state, i.status AS institution_status
      FROM users u
      LEFT JOIN institutions i ON u.institution_id = i.id
      WHERE u.id = $1
    `;
    const result = await query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    const user = result.rows[0];

    const profile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      institution_id: user.institution_id,
      is_active: user.is_active,
      created_at: user.created_at,
    };

    if (user.role === 'institution_admin' && user.institution_id) {
      profile.institution = {
        id: user.institution_id,
        name: user.institution_name,
        aicte_code: user.aicte_code,
        state: user.state,
        status: user.institution_status,
      };
    }

    return res.status(200).json({
      success: true,
      message: 'User profile fetched successfully.',
      data: {
        user: profile,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (Stateless JWT acknowledgement)
 * @access  Private (authenticateToken required)
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please remove your token from client storage.',
    data: null,
  });
};

module.exports = {
  register,
  login,
  getMe,
  logout,
};
