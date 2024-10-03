const jwt = require('jsonwebtoken');
const { verifyToken } = require('../utils/auth');
const User = require('../models/user');
const { errorResponse } = require('../utils/responseHelper');
const messageHelper = require('../utils/messageHelper');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return errorResponse(res, 401, 'Authorization header is missing');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return errorResponse(res, 401, 'Token is missing');
    }

    let decoded;
    try {
      decoded = verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        console.log(error,'wertyu')
      return errorResponse(res, 401, 'Invalid or expired token');
    }

    const user = await User.findOne({ phoneNumber: decoded.phoneNumber });
    if (!user) {
      return errorResponse(res, 401, 'User not found');
    }

    req.user = user;
    next();

    
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
  }
};

module.exports = authMiddleware;