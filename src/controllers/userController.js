const dotenv = require("dotenv");
dotenv.config();
const messageHelper = require("../utils/messageHelper");
const { errorResponse, successResponse } = require("../utils/responseHelper");
const asyncHandler = require("../utils/asyncHandler");
const userHelper = require("../helpers/userHelper");
const Auth = require("../utils/auth");
const { getUsersController } = require("./admin");
const User = require("../models/user");
const FriendRequest = require("../models/adda/friendRequest");

module.exports = {
  registerController: asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;

    // Validate required fields
    if (!phoneNumber) {
      errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    const result = await userHelper.register(req.body);
    if (!result) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }

    return successResponse(res, 200, messageHelper.OTP_SENT_SUCCESSFULLY, {
      result,
    });
  }),

  loginController: asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    const result = await userHelper.login({ phoneNumber });
    if (!result) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }
    console.log("Login result", result);
    successResponse(res, 200, messageHelper.OTP_SENT_SUCCESSFULLY, result);
  }),

  verifyUserRegistrationController: asyncHandler(async (req, res) => {
    const { otp, phoneNumber } = req.body;
    console.log(otp, "popooppo");
    if (!otp) {
      return errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    const result = await userHelper.verifyUserRegistration(otp, phoneNumber);
    if (!result) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }

    const accessToken = Auth.createAccessToken(
      { phoneNumber },
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = Auth.createRefreshToken(
      { phoneNumber },
      process.env.REFRESH_TOKEN_SECRET
    );

    return successResponse(
      res,
      200,
      messageHelper.SUCCESSFULLY_REGISTERED_USER,
      { result, accessToken, refreshToken }
    );
  }),

  verifyUserLoginController: asyncHandler(async (req, res) => {
    const { otp, phoneNumber } = req.body;
    const token = req.headers.authorization?.split(" ")[1];

    if (!otp) {
      return errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    const result = await userHelper.verifyUserLogin(phoneNumber, otp, token);
    if (!result) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }

    const accessToken = Auth.createAccessToken(
      { phoneNumber },
      process.env.ACCESS_TOKEN_SECRET
    );
    const refreshToken = Auth.createRefreshToken(
      { phoneNumber },
      process.env.REFRESH_TOKEN_SECRET
    );

    return successResponse(res, 200, messageHelper.SUCCESSFULLY_LOGGED_USER, {
      result,
      accessToken,
      refreshToken,
    });
  }),

  logoutController: asyncHandler(async (req, res) => {
    const { phoneNumber } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
    console.log(token);
    if (!token) {
      return errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    const result = await userHelper.logout(token, phoneNumber);
    console.log(result);
    if (!result) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }
    return successResponse(
      res,
      200,
      messageHelper.SUCCESSFULLY_LOGOUT_USER,
      result
    );
  }),

  refreshTokenController: asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return errorResponse(res, 400, messageHelper.MISSING_REQUIRED_FIELDS);
    }

    try {
      const decoded = Auth.verifyToken(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
      const accessToken = Auth.createAccessToken(
        { phoneNumber: decoded.phoneNumber },
        process.env.ACCESS_TOKEN_SECRET
      );
      return successResponse(res, 200, messageHelper.TOKEN_REFRESHED, {
        accessToken,
      });
    } catch (error) {
      return errorResponse(res, 401, messageHelper.INVALID_REFRESH_TOKEN);
    }
  }),

  premiumController: asyncHandler(async (req, res) => {
    const { name, email, phoneNumber, city } = req.body;

    if (!(name && email && phoneNumber && city)) {
      return errorResponse(res, 400, "Missing Required Fields");
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (!existingUser) {
      return errorResponse(res, 404, "User doesn't exist");
    }

    const premiumResult = await userHelper.handlePremium(
      existingUser,
      name,
      email,
      city
    );

    if (!premiumResult.success) {
      return errorResponse(res, 402, premiumResult.message);
    }

    return successResponse(res, 200, premiumResult.message, {
      premiumEndDate: premiumResult.premiumEndDate,
    });
  }),
  changeRoleController: asyncHandler(async (req, res, next) => {
    const { user_id } = req.params;
    const { role } = req.body;
    const { userId } = req.auth;
    const superAdminUserId = userId;

    if (!superAdminUserId || !user_id || !role) {
      return errorResponse(res, 400, messageHelper.BAD_REQUEST);
    }
    const modifiedUser = await userHelper.changeRole(
      superAdminUserId,
      user_id,
      role
    );
    if (!modifiedUser) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }
    return successResponse(
      res,
      200,
      "Successfully changed user role.",
      modifiedUser
    );
  }),

  getAllUsersController: asyncHandler(async (req, res) => {
    const {
      search,
      sortField,
      sortOrder,
      page = 1,
      limit = 10,
      filter,
    } = req.query;
    const queryOptions = {
      search,
      sortField,
      sortOrder,
      page: parseInt(page),
      limit: parseInt(limit),
      filter: filter || {},
    };

    const { users, totalCount, totalPages } = await userHelper.getAllUser(
      queryOptions
    );

    if (!users) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR);
    }

    return successResponse(res, 200, "Successfully fetched users", {
      users,
      currentPage: queryOptions.page,
      totalPages,
      totalCount,
    });
  }),

  getUserController: asyncHandler(async (req, res, next) => {
    const userId = req.user.dbUser._id;
    if (!userId) {
      return errorResponse(res, 400, "Id is required", userId);
    }
    const user = await userHelper.getUser(userId);
    if (!user) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR, user);
    }
    return successResponse(res, 200, "Successfully fetched user", user);
  }),
  DeleteUserClerkController: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clerkSecretKey}`,
      },
    });
    if (!response.ok) {
      return errorResponse(res, 500, "Failed to delete user");
    }
    const data = await response.json();
    return successResponse(res, 200, "Successfully deleted user", data);
  }),
  viewAllocatedCalls: asyncHandler(async (req, res, next) => {
    const { search, sortField, sortOrder, page, limit } = req.query;
    const { userId } = req.auth;
    const calls = await userHelper.viewAllocatedCalls(
      userId,
      search,
      sortField,
      sortOrder,
      page,
      limit
    );
    if (!calls) {
      return errorResponse(res, 400, messageHelper.BAD_REQUEST);
    }
    return successResponse(
      res,
      200,
      "Successfully fetched allocated calls",
      calls
    );
  }),
  updateProfileController: asyncHandler(async (req, res) => {
    const userId = req.user.dbUser._id;
    const profileData = req.body;

    console.log(userId);

    if (!userId) {
      return errorResponse(res, 400, "User ID is required");
    }

    try {
      const updatedProfile = await userHelper.updateProfile(
        userId,
        profileData
      );
      return successResponse(
        res,
        200,
        "Profile updated successfully",
        updatedProfile
      );
    } catch (error) {
      return errorResponse(
        res,
        500,
        error.message || "Failed to update profile"
      );
    }
  }),
  toggleFollowController: asyncHandler(async (req, res) => {
    const userId = req.user.dbUser._id;
    const { targetUserId } = req.params;

    if (!userId || !targetUserId) {
      return errorResponse(res, 400, "User ID and target user ID are required");
    }

    try {
      const result = await userHelper.toggleFollow(userId, targetUserId);
      return successResponse(
        res,
        200,
        `Successfully ${result.action} user`,
        result
      );
    } catch (error) {
      return errorResponse(
        res,
        500,
        error.message || "Failed to toggle follow status"
      );
    }
  }),
  getUserStatsController: asyncHandler(async (req, res) => {
    const userId = req.params.userId || req.user.dbUser._id;

    if (!userId) {
      return errorResponse(res, 400, "User ID is required");
    }

    try {
      const stats = await userHelper.getUserStats(userId);
      return successResponse(
        res,
        200,
        "User stats retrieved successfully",
        stats
      );
    } catch (error) {
      return errorResponse(
        res,
        500,
        error.message || "Failed to retrieve user stats"
      );
    }
  }),

  getOtherUserController: asyncHandler(async (req, res, next) => {
    const userId = req.params.userId;
    console.log("User-ID", userId);
    if (!userId) {
      return errorResponse(res, 400, "Id is required", userId);
    }
    const user = await userHelper.getOtherUserDetails(userId);
    if (!user) {
      return errorResponse(res, 500, messageHelper.INTERNAL_SERVER_ERROR, user);
    }
    return successResponse(res, 200, "Successfully fetched user", user);
  }),

  getUserProfile: asyncHandler(async (req, res, next) => {
    const friendId = req.params.friendId;
    const userId = req.user.dbUser._id;

    if (!friendId) {
      return errorResponse(res, 400, "Friend ID is required");
    }

    const [friendUser, currentUser] = await Promise.all([
      User.findById(friendId),
      User.findById(userId),
    ]);

    if (!friendUser) {
      return errorResponse(res, 404, "User not found");
    }

    const isFriend = currentUser.followers.includes(friendId);

    return successResponse(res, 200, "Successfully fetched user", {
      user: friendUser,
      isFriend,
    });
  }),
};
