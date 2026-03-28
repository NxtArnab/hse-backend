import mongoose from "mongoose";
import Notification from "../src/notification/notification.model.js";

const normalizeRecipientId = (recipientId) => {
  if (!recipientId) return "";
  const normalized = String(recipientId).trim();
  return mongoose.Types.ObjectId.isValid(normalized) ? normalized : "";
};

export const sendNotification = async ({
  recipientId,
  senderId,
  message,
  type = "incident_observation",
  link = "",
}) => {
  try {
    const normalizedRecipientId = normalizeRecipientId(recipientId);
    if (!normalizedRecipientId || !message) return null;

    return await Notification.create({
      recipient: normalizedRecipientId,
      sender: normalizeRecipientId(senderId) || null,
      message,
      type,
      link,
    });
  } catch (error) {
    console.error("Error in sendNotification:", error);
    return null;
  }
};

export const sendBulkNotifications = async (recipientIds = [], notificationData = {}) => {
  const uniqueRecipientIds = Array.from(
    new Set(recipientIds.map(normalizeRecipientId).filter(Boolean)),
  );

  if (uniqueRecipientIds.length === 0) {
    return [];
  }

  return Promise.all(
    uniqueRecipientIds.map((recipientId) => sendNotification({
      ...notificationData,
      recipientId,
    })),
  );
};