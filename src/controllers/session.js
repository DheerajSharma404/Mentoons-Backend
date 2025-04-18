const moment = require("moment");
const Employee = require("../models/employee");
const SessionModel = require("../models/session");
const User = require("../models/user");

const getUserSession = async (req, res) => {
  try {
    const userClerkId = req.user.id;

    const user = await User.findOne({ clerkId: userClerkId });

    const existingSession = await SessionModel.find({
      user: user._id,
    })
      .populate("user")
      .populate("psychologistId");
    if (existingSession.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No session found",
      });
    }

    return res.status(200).json({ success: true, session: existingSession });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const findAvailablePsychologist = async (date, time, state, sessionID) => {
  try {
    const sessionDate = new Date(date);
    const sessionDateTime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");

    const startRange = sessionDateTime
      .clone()
      .subtract(1, "hour")
      .format("HH:mm");
    const endRange = sessionDateTime.clone().add(1, "hour").format("HH:mm");

    const psychologists = await Employee.find({ role: "psychologist" });

    for (const psychologist of psychologists) {

      const sessionCount = await SessionModel.countDocuments({
        psychologistId: psychologist._id,
        date: sessionDate,
        ...(sessionID ? { _id: { $ne: sessionID } } : {}),
      });

      const hasSessionAtSameTime = await SessionModel.exists({
        psychologistId: psychologist._id,
        status: "booked",
        date: sessionDate,
        time: {
          $gte: startRange,
          $lte: endRange,
        },
        ...(sessionID ? { _id: { $ne: sessionID } } : {}),
      });

      const isStateMatching = psychologist.place?.state === state;

      if (sessionCount < 10 && !hasSessionAtSameTime && isStateMatching) {
        return psychologist;
      } else {
        console.log(`❌ Psychologist not available: ${psychologist.name}`);
      }
    }
    return null;
  } catch (err) {
    console.error("🚨 Error in findAvailablePsychologist:", err.message);
    return null;
  }
};

const availabiltyCheck = async (req, res) => {
  try {
    const { time, date, state, sessionID, type } = req.query;
    const userClerkId = req.user.id;

    const user = await User.findOne({ clerkId: userClerkId });
    console.log("User fetched from DB:", user?.email || "Not Found");

    const availablePsychologist = await findAvailablePsychologist(
      date,
      time,
      state,
      sessionID
    );

    if (!availablePsychologist) {
      console.log("No available psychologists found");
      return res.status(400).json({
        success: false,
        message:
          "All psychologists are fully booked at the selected date and time. Please choose another slot.",
        isAvailable: false,
      });
    }

    if (type === "check") {
      console.log("Slot is available for check");
      return res.status(200).json({
        success: true,
        message: "Slot available",
        isAvailable: true,
      });
    }

    if (type === "update") {
      console.log("Attempting to update session...");
      const updateSession = await SessionModel.findOneAndUpdate(
        {
          _id: sessionID,
          user: user._id,
          psychologistId: availablePsychologist._id,
        },
        { $set: { date: date, time: time } },
        { new: true }
      ).populate("psychologistId");

      if (!updateSession) {
        console.log("Session not found or update not allowed");
        return res.status(404).json({
          success: false,
          message: "Session not found or not eligible for update.",
        });
      }

      console.log("Session updated:", updateSession);
      return res.status(200).json({
        success: true,
        message: `Slot updated to ${date} at ${time}`,
        updatedSession: updateSession,
      });
    }

    console.log("Invalid type provided:", type);
    return res.status(400).json({
      success: false,
      message: "Invalid request type. Use 'check' or 'update'.",
    });
  } catch (err) {
    console.log("Error in availabilityCheck:", err.message);
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  getUserSession,
  availabiltyCheck,
  findAvailablePsychologist,
};
