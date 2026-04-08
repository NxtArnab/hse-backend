import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import IncidentModel from "./incident.model.js";
import { sendBulkNotifications } from "../../utils/sendNotification.js";
import User from "../user/user.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const normalizeRoleKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");

const isSystemAdmin = (user = {}) => {
  if (user?.isAdmin === true) return true;

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.some((role) => {
    const normalized = normalizeRoleKey(role);
    return normalized === "admin" || normalized === "projectadmin" || normalized === "systemadmin";
  });
};

const toObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value?._id) return String(value._id);
    if (value?.id) return String(value.id);
  }
  return String(value);
};

const canManageIncident = (incident, user = {}) => {
  if (!incident || !user?.id) return false;
  if (isSystemAdmin(user)) return true;

  const userId = String(user.id);
  const createdById = toObjectIdString(incident.createdBy);
  const investigationAuthorityId = toObjectIdString(incident.investigation_authority);
  
  // Allow observers to manage incidents
  const isObserver = incident?.actions && Array.isArray(incident.actions) && 
    incident.actions.some((action) => String(action?.observation?.observedBy || "").trim() === userId);

  return createdById === userId || investigationAuthorityId === userId || isObserver;
};

const ensureIncidentNumbers = async () => {
  const numberedCount = await IncidentModel.countDocuments({
    incidentNumber: { $exists: true, $ne: null },
  });

  if (numberedCount === 0) {
    const incidents = await IncidentModel.find()
      .select("_id")
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    if (incidents.length === 0) return;

    await IncidentModel.bulkWrite(
      incidents.map((incident, index) => ({
        updateOne: {
          filter: { _id: incident._id },
          update: { $set: { incidentNumber: index + 1 } },
        },
      }))
    );

    return;
  }

  const latestIncident = await IncidentModel.findOne({
    incidentNumber: { $exists: true, $ne: null },
  })
    .sort({ incidentNumber: -1 })
    .select("incidentNumber")
    .lean();

  let nextIncidentNumber = Number(latestIncident?.incidentNumber || 0) + 1;

  const missingIncidents = await IncidentModel.find({
    $or: [
      { incidentNumber: { $exists: false } },
      { incidentNumber: null },
    ],
  })
    .select("_id")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (missingIncidents.length === 0) return;

  await IncidentModel.bulkWrite(
    missingIncidents.map((incident) => ({
      updateOne: {
        filter: { _id: incident._id },
        update: { $set: { incidentNumber: nextIncidentNumber++ } },
      },
    }))
  );
};

const getNextIncidentNumber = async () => {
  await ensureIncidentNumbers();

  const latestIncident = await IncidentModel.findOne({
    incidentNumber: { $exists: true, $ne: null },
  })
    .sort({ incidentNumber: -1 })
    .select("incidentNumber")
    .lean();

  return Number(latestIncident?.incidentNumber || 0) + 1;
};

const normalizeAttachments = (incident_attachments, incident_attachment) => {
  if (Array.isArray(incident_attachments)) return incident_attachments.filter(Boolean);
  if (incident_attachment) return [incident_attachment];
  return [];
};

const normalizeInvestigationFiles = (files = []) => (
  (Array.isArray(files) ? files : [])
    .filter(Boolean)
    .map((file = {}) => ({
      driveItemId: String(file?.driveItemId || "").trim(),
      originalName: String(file?.originalName || "").trim(),
      storedName: String(file?.storedName || "").trim(),
      fileUrl: String(file?.fileUrl || "").trim(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
);

const normalizeInvestigationState = (source = {}) => ({
  hazard: String(source?.hazard || "").trim(),
  contributingBehaviour: String(source?.investigation_contributing_behaviour || "").trim(),
  contributingCondition: String(source?.investigation_contributing_condition || "").trim(),
  comments: String(source?.investigation_comments || "").trim(),
  authority: toObjectIdString(source?.investigation_authority),
  signature: {
    dataUrl: String(source?.investigation_signature?.dataUrl || "").trim(),
    signedBy: toObjectIdString(source?.investigation_signature?.signedBy),
    signedAt: source?.investigation_signature?.signedAt
      ? new Date(source.investigation_signature.signedAt).toISOString()
      : "",
  },
  files: normalizeInvestigationFiles(source?.investigation_files),
});

const hasSignedInvestigation = (source = {}) => Boolean(
  String(source?.investigation_signature?.dataUrl || "").trim()
);

const normalizeSingleAttachment = (file = null) => {
  if (!file) return null;

  return {
    driveItemId: String(file?.driveItemId || "").trim(),
    originalName: String(file?.originalName || "").trim(),
    storedName: String(file?.storedName || "").trim(),
    fileUrl: String(file?.fileUrl || "").trim(),
  };
};

const normalizeWitnesses = (witnesses = []) => (
  (Array.isArray(witnesses) ? witnesses : []).map((witness = {}) => ({
    name: String(witness?.name || "").trim(),
    statement: String(witness?.statement || "").trim(),
    dateReceived: witness?.dateReceived ? new Date(witness.dateReceived).toISOString() : "",
    attachment: normalizeSingleAttachment(witness?.attachment || null),
  }))
);

const normalizeObservedByLocks = (actions = []) => (
  (Array.isArray(actions) ? actions : []).map((action = {}) => String(action?.observation?.observedBy || "").trim())
);

const normalizeActions = (actions) => {
  if (!Array.isArray(actions)) return [];

  return actions.map((action = {}) => {
    const { type, ...rest } = action;
    return rest;
  });
};

const getAssignedToRecipients = (actions = []) => Array.from(
  new Set(
    (Array.isArray(actions) ? actions : [])
      .map((action) => action?.assignedTo)
      .map((value) => String(value || "").trim())
      .filter((value) => mongoose.Types.ObjectId.isValid(value)),
  ),
);

const notifyAssignedUsers = async ({ incident, recipientIds = [], senderId }) => {
  if (!incident || recipientIds.length === 0) return;

  const incidentLabel = incident.incident_title || `Incident ${incident.incidentNumber || ""}`.trim() || "an incident";
  const message = `You have been assigned an action for "${incidentLabel}".`;

  await sendBulkNotifications(recipientIds, {
    senderId,
    message,
    type: "incident_action_assigned",
    link: "/hse",
  });
};

const buildIncidentPayload = (payload) => {
  const normalizedAttachments = normalizeAttachments(payload.incident_attachments, payload.incident_attachment);

  return {
    incident_title: payload.incident_title,
    incident_eventTime: payload.incident_eventTime,
    incident_recordable: payload.incident_recordable,
    incident_description: payload.incident_description,
    location: payload.location,
    incident_eventDate: payload.incident_eventDate,
    incident_timeUnknown: payload.incident_timeUnknown,
    distributionRoles: payload.distributionRoles,
    distributionUsers: payload.distributionUsers,
    incident_attachment: normalizedAttachments[0] || payload.incident_attachment || null,
    incident_attachments: normalizedAttachments,
    hazard: payload.hazard,
    investigation_contributing_behaviour: payload.investigation_contributing_behaviour,
    investigation_contributing_condition: payload.investigation_contributing_condition,
    investigation_comments: payload.investigation_comments,
    investigation_files: Array.isArray(payload.investigation_files) ? payload.investigation_files.filter(Boolean) : [],
    investigation_authority: payload.investigation_authority || null,
    investigation_signature: payload.investigation_signature || null,
    recordTypeForms: payload.recordTypeForms,
    observation_description: payload.observation_description,
    observation_status: payload.observation_status,
    observation_observedBy: payload.observation_observedBy,
    observation_files: payload.observation_files,
    witnesses: payload.witnesses,
    actions: normalizeActions(payload.actions),
  };
};

const getObservedByRecipients = (actions = []) => Array.from(
  new Set(
    (Array.isArray(actions) ? actions : [])
      .map((action) => action?.observation?.observedBy)
      .map((value) => String(value || "").trim())
      .filter((value) => mongoose.Types.ObjectId.isValid(value)),
  ),
);

const getIncidentLabel = (incident) =>
  incident?.incident_title || `Incident ${incident?.incidentNumber || ""}`.trim() || "an incident";

const notifyObservedUsers = async ({ incident, recipientIds = [], senderId, isNewAssignment = false }) => {
  if (!incident || recipientIds.length === 0) return;

  const incidentLabel = getIncidentLabel(incident);
  const message = isNewAssignment
    ? `You have been selected in Observed By for "${incidentLabel}".`
    : `You have been assigned as an observer for "${incidentLabel}".`;

  await sendBulkNotifications(recipientIds, {
    senderId,
    message,
    type: isNewAssignment ? "incident_update" : "incident_observation",
    link: "/hse",
  });
};

const notifyInvestigationAuthorityAssigned = async ({ incident, recipientId, senderId, isNewAssignment = false }) => {
  if (!incident) return;

  const normalizedRecipientId = String(recipientId || "").trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedRecipientId)) return;
  if (String(senderId || "") === normalizedRecipientId) return;

  const incidentLabel = getIncidentLabel(incident);
  const message = isNewAssignment
    ? `You have been selected as Investigation Authority for "${incidentLabel}". Please complete the investigation process.`
    : `You have been assigned as Investigation Authority for "${incidentLabel}". Please complete the investigation process.`;

  await sendBulkNotifications([normalizedRecipientId], {
    senderId,
    message,
    type: "incident_update",
    link: "/hse",
  });
};

const getSafetyOfficerRecipientIds = async () => {
  const users = await User.find({
    isActive: { $ne: false },
    roles: { $elemMatch: { $regex: /^\s*safety[\s_-]*officer\s*$/i } },
  })
    .select("_id")
    .lean();

  return users
    .map((user) => String(user?._id || "").trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
};

const notifySafetyOfficersForInvestigationSignature = async ({ incident, senderId }) => {
  if (!incident) return;

  const incidentLabel = getIncidentLabel(incident);
  const recipientIds = await getSafetyOfficerRecipientIds();
  const filteredRecipientIds = recipientIds.filter((id) => String(id) !== String(senderId));

  if (filteredRecipientIds.length === 0) return;

  await sendBulkNotifications(filteredRecipientIds, {
    senderId,
    message: `Investigation authority signed "${incidentLabel}". Safety Officer, please check the further process/step.`,
    type: "incident_update",
    link: "/hse",
  });
};

const notifySafetyOfficersForObserverCompleted = async ({ incident, senderId }) => {
  if (!incident) return;

  const incidentLabel = getIncidentLabel(incident);
  const recipientIds = await getSafetyOfficerRecipientIds();
  const filteredRecipientIds = recipientIds.filter((id) => String(id) !== String(senderId));

  if (filteredRecipientIds.length === 0) return;

  await sendBulkNotifications(filteredRecipientIds, {
    senderId,
    message: `Observer has completed and signed "${incidentLabel}".`,
    type: "incident_update",
    link: "/hse",
  });
};

const getEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getGraphConfig = () => {
  const tenantId = getEnv("TENANT_ID", "AZURE_TENANT_ID", "MICROSOFT_TENANT_ID");
  const clientId = getEnv("CLIENT_ID", "AZURE_CLIENT_ID", "MICROSOFT_CLIENT_ID");
  const clientSecret = getEnv("CLIENT_SECRET", "AZURE_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET");
  const siteId = getEnv("SITE_ID", "SHAREPOINT_SITE_ID", "GRAPH_SITE_ID");
  const driveId = getEnv("DRIVE_ID", "SHAREPOINT_DRIVE_ID", "GRAPH_DRIVE_ID");

  return { tenantId, clientId, clientSecret, siteId, driveId };
};

const getAccessToken = async () => {
  const { tenantId, clientId, clientSecret } = getGraphConfig();
  const missing = [];
  if (!tenantId) missing.push("TENANT_ID");
  if (!clientId) missing.push("CLIENT_ID");
  if (!clientSecret) missing.push("CLIENT_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Attachment upload is not configured. Missing environment variable(s): ${missing.join(", ")}.`,
    );
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 && errorText.includes("AADSTS7000216")) {
      throw new Error(
        "Failed to get access token: Azure rejected client credentials. Verify CLIENT_ID, TENANT_ID, CLIENT_SECRET value and secret expiry in Azure App Registration.",
      );
    }
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
};

const buildStoredFileName = (originalName) => {
  const parsed = path.parse(originalName || "attachment");
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const dateStr = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-");
  const timeStr = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("-");
  return `${parsed.name}_${dateStr}_${timeStr}${parsed.ext}`;
};

const DOCUMENT_UPLOAD_FOLDER = "Document";
const SIGNATURE_UPLOAD_FOLDER = "Signature";

const DATA_URL_IMAGE_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const getExtensionFromMimeType = (mimeType = "") => {
  const normalized = String(mimeType).toLowerCase();
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "image/gif") return ".gif";
  if (normalized === "image/svg+xml") return ".svg";
  return "";
};

const parseDataUrlImage = (value = "") => {
  const match = String(value).trim().match(DATA_URL_IMAGE_REGEX);
  if (!match) return null;

  const mimeType = match[1];
  const base64Data = match[2];

  return {
    mimeType,
    buffer: Buffer.from(base64Data, "base64"),
  };
};

const uploadBufferToDrive = async ({ siteId, driveId, accessToken, folderName, fileName, mimeType, buffer }) => {
  const encodedPath = `${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload signature: ${errorText}`);
  }

  return uploadResponse.json();
};

const uploadSignatureIfNeeded = async ({ signature, filePrefix, siteId, driveId, accessToken }) => {
  if (!signature || typeof signature !== "object") return signature;

  const hasDriveItem = String(signature?.driveItemId || "").trim();
  const dataUrl = String(signature?.dataUrl || "").trim();

  if (hasDriveItem || !dataUrl) return signature;

  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) return signature;

  const extension = getExtensionFromMimeType(parsed.mimeType) || ".png";
  const storedName = buildStoredFileName(`${filePrefix}${extension}`);
  const uploadedItem = await uploadBufferToDrive({
    siteId,
    driveId,
    accessToken,
    folderName: SIGNATURE_UPLOAD_FOLDER,
    fileName: storedName,
    mimeType: parsed.mimeType,
    buffer: parsed.buffer,
  });

  return {
    ...signature,
    driveItemId: uploadedItem?.id || "",
    originalName: `${filePrefix}${extension}`,
    storedName: uploadedItem?.name || storedName,
    fileUrl: uploadedItem?.webUrl || "",
    uploadFolder: SIGNATURE_UPLOAD_FOLDER,
    mimeType: parsed.mimeType,
  };
};

const persistIncidentSignatures = async (incidentPayload = {}) => {
  const { siteId, driveId } = getGraphConfig();
  if (!siteId || !driveId) {
    throw new Error("Signature upload is not configured. Missing SITE_ID or DRIVE_ID.");
  }

  const accessToken = await getAccessToken();

  incidentPayload.investigation_signature = await uploadSignatureIfNeeded({
    signature: incidentPayload?.investigation_signature,
    filePrefix: "investigation_signature",
    siteId,
    driveId,
    accessToken,
  });

  if (Array.isArray(incidentPayload.actions)) {
    for (let index = 0; index < incidentPayload.actions.length; index += 1) {
      const action = incidentPayload.actions[index];
      if (!action?.observation?.observation_signature) continue;

      action.observation.observation_signature = await uploadSignatureIfNeeded({
        signature: action.observation.observation_signature,
        filePrefix: `observation_signature_${index + 1}`,
        siteId,
        driveId,
        accessToken,
      });
    }
  }

  return incidentPayload;
};

const getUploadSubfolder = (req, file) => {
  const explicitType = String(
    req?.body?.folderType || req?.body?.uploadType || req?.query?.folderType || req?.query?.uploadType || "",
  )
    .trim()
    .toLowerCase();

  if (explicitType === "signature") return SIGNATURE_UPLOAD_FOLDER;
  if (explicitType === "document") return DOCUMENT_UPLOAD_FOLDER;

  const nameHint = String(file?.originalname || "").toLowerCase();
  const fieldHint = String(file?.fieldname || "").toLowerCase();
  if (nameHint.includes("signature") || fieldHint.includes("signature")) {
    return SIGNATURE_UPLOAD_FOLDER;
  }

  return DOCUMENT_UPLOAD_FOLDER;
};

export const uploadIncidentAttachment = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { siteId, driveId } = getGraphConfig();
    if (!siteId || !driveId) {
      return res.status(500).json({
        message:
          "Attachment upload is not configured. Missing SITE_ID or DRIVE_ID.",
      });
    }

    const accessToken = await getAccessToken();
    const storedName = buildStoredFileName(file.originalname);
  const uploadSubfolder = getUploadSubfolder(req, file);
  const encodedPath = `${encodeURIComponent(uploadSubfolder)}/${encodeURIComponent(storedName)}`;
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": file.mimetype,
      },
      body: file.buffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload attachment: ${errorText}`);
    }

    const data = await uploadResponse.json();

    return res.status(201).json({
      message: "Attachment uploaded successfully",
      data: {
        driveItemId: data.id || "",
        originalName: file.originalname,
        storedName: data.name || storedName,
        fileUrl: data.webUrl || "",
        uploadFolder: uploadSubfolder,
        mimeType: file.mimetype,
        fileSize: file.size,
        extension: path.extname(file.originalname || "").toLowerCase(),
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const previewIncidentAttachment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Attachment id is required" });
    }

    const { siteId, driveId } = getGraphConfig();
    if (!siteId || !driveId) {
      return res.status(500).json({
        message:
          "Attachment preview is not configured. Missing SITE_ID or DRIVE_ID.",
      });
    }

    const accessToken = await getAccessToken();
    const fileContentUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${id}/content`;

    const response = await fetch(fileContentUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to preview attachment: ${errorText}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return res.status(200).json({
      message: "Attachment preview fetched successfully",
      data: `data:${contentType};base64,${base64}`,
      contentType,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

export const createIncident = async (req, res) => {
  try {
    const incidentPayload = await persistIncidentSignatures(buildIncidentPayload(req.body));
    const incidentNumber = await getNextIncidentNumber();

    const incident = await IncidentModel.create({
      ...incidentPayload,
      incidentNumber,
      createdBy: req.user.id,
    });

    await notifyObservedUsers({
      incident,
      recipientIds: getObservedByRecipients(incidentPayload.actions),
      senderId: req.user.id,
      isNewAssignment: false,
    });

    await notifyAssignedUsers({
      incident,
      recipientIds: getAssignedToRecipients(incidentPayload.actions),
      senderId: req.user.id,
    });

    if (incidentPayload?.investigation_authority) {
      await notifyInvestigationAuthorityAssigned({
        incident,
        recipientId: incidentPayload.investigation_authority,
        senderId: req.user.id,
        isNewAssignment: false,
      });
    }

    if (incidentPayload?.investigation_signature?.dataUrl) {
      await notifySafetyOfficersForInvestigationSignature({
        incident,
        senderId: req.user.id,
      });
    }

    res
      .status(201)
      .json({ message: "Incident Created Successfully", data: incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncidents = async (req, res) => {
  try {
    await ensureIncidentNumbers();

    const incidents = await IncidentModel.find()
      .populate("createdBy", "name email")
      .populate("investigation_authority", "name email")
      .sort({ createdAt: -1 });
    res.status(200).json({ data: incidents });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncidentById = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await IncidentModel.findById(id)
      .populate("createdBy", "name email")
      .populate("investigation_authority", "name email");
    if (!incident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }
    res.status(200).json({ data: incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const incidentPayload = await persistIncidentSignatures(buildIncidentPayload(req.body));

    const existingIncident = await IncidentModel.findById(id).select("createdBy actions witnesses incident_title incidentNumber investigation_signature investigation_authority hazard investigation_contributing_behaviour investigation_contributing_condition investigation_comments investigation_files");
    if (!existingIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    if (!canManageIncident(existingIncident, req.user)) {
      return res.status(403).json({ message: "You are not authorized to update this incident" });
    }

    // Determine if user is observer-only (not creator or authority)
    const userId = String(req.user.id);
    const createdById = toObjectIdString(existingIncident.createdBy);
    const authorityId = toObjectIdString(existingIncident.investigation_authority);
    const isObserverOnly = !isSystemAdmin(req.user) && createdById !== userId && authorityId !== userId;

    // Skip investigation and witness checks for observers - they can only edit observations
    if (!isObserverOnly && hasSignedInvestigation(existingIncident)) {
      const previousInvestigationState = normalizeInvestigationState(existingIncident);
      const nextInvestigationState = normalizeInvestigationState(incidentPayload);

      if (JSON.stringify(previousInvestigationState) !== JSON.stringify(nextInvestigationState)) {
        return res.status(400).json({
          message: "Investigation can no longer be edited after the Investigation Authority signature is saved.",
        });
      }
    }

    // Skip witness check for observers
    if (!isObserverOnly) {
      const previousWitnesses = normalizeWitnesses(existingIncident.witnesses);
      const nextWitnesses = normalizeWitnesses(incidentPayload.witnesses);

      const existingWitnessesWereModified = nextWitnesses.length < previousWitnesses.length
        || previousWitnesses.some((witness, index) => JSON.stringify(witness) !== JSON.stringify(nextWitnesses[index] || null));

      if (existingWitnessesWereModified) {
        return res.status(400).json({
          message: "Existing witness records cannot be edited after incident creation. You can only add new witness records.",
        });
      }
    }

    const previousObservedByLocks = normalizeObservedByLocks(existingIncident.actions);
    const nextObservedByLocks = normalizeObservedByLocks(incidentPayload.actions);
    const observedByWasChangedAfterBeingSet = previousObservedByLocks.some((observedBy, index) => (
      observedBy && observedBy !== String(nextObservedByLocks[index] || "").trim()
    ));

    if (observedByWasChangedAfterBeingSet) {
      return res.status(400).json({
        message: "Observed By cannot be changed once it has been set.",
      });
    }

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      id,
      incidentPayload,
      { new: true },
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    const previousRecipients = new Set(getObservedByRecipients(existingIncident.actions));
    const nextRecipients = getObservedByRecipients(incidentPayload.actions);
    const newlyAssignedRecipients = nextRecipients.filter((recipientId) => !previousRecipients.has(recipientId));

    await notifyObservedUsers({
      incident: updatedIncident,
      recipientIds: newlyAssignedRecipients,
      senderId: req.user.id,
      isNewAssignment: true,
    });

    const previousAssigned = new Set(getAssignedToRecipients(existingIncident.actions));
    const nextAssigned = getAssignedToRecipients(incidentPayload.actions);
    const newlyAssignedActionUsers = nextAssigned.filter((id) => !previousAssigned.has(id));

    await notifyAssignedUsers({
      incident: updatedIncident,
      recipientIds: newlyAssignedActionUsers,
      senderId: req.user.id,
    });

    const previousInvestigationAuthorityId = String(existingIncident?.investigation_authority || "").trim();
    const nextInvestigationAuthorityId = String(incidentPayload?.investigation_authority || "").trim();
    const investigationAuthorityWasJustAssigned = Boolean(nextInvestigationAuthorityId)
      && nextInvestigationAuthorityId !== previousInvestigationAuthorityId;

    if (investigationAuthorityWasJustAssigned) {
      await notifyInvestigationAuthorityAssigned({
        incident: updatedIncident,
        recipientId: nextInvestigationAuthorityId,
        senderId: req.user.id,
        isNewAssignment: true,
      });
    }

    const previousSignatureDataUrl = String(existingIncident?.investigation_signature?.dataUrl || "").trim();
    const nextSignatureDataUrl = String(incidentPayload?.investigation_signature?.dataUrl || "").trim();
    const signatureWasJustSaved = Boolean(nextSignatureDataUrl) && nextSignatureDataUrl !== previousSignatureDataUrl;

    if (signatureWasJustSaved) {
      await notifySafetyOfficersForInvestigationSignature({
        incident: updatedIncident,
        senderId: req.user.id,
      });
    }

    // Detect if any observation was just completed with a new observer signature
    const observerJustSigned = (incidentPayload.actions || []).some((newAction, i) => {
      const newObs = newAction?.observation;
      if (!newObs) return false;
      if (String(newObs.actionStatus || '').trim() !== 'Completed') return false;
      const newSigUrl = String(newObs.observation_signature?.dataUrl || '').trim();
      if (!newSigUrl) return false;
      const oldSigUrl = String(existingIncident.actions?.[i]?.observation?.observation_signature?.dataUrl || '').trim();
      return newSigUrl !== oldSigUrl;
    });

    if (observerJustSigned) {
      await notifySafetyOfficersForObserverCompleted({
        incident: updatedIncident,
        senderId: req.user.id,
      });
    }

    res.status(200).json({ message: "Incident Updated Successfully", data: updatedIncident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const deleteIncident = async (req, res) => {
  try {
    const { id } = req.params;

    const existingIncident = await IncidentModel.findById(id).select("createdBy");
    if (!existingIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    if (!canManageIncident(existingIncident, req.user)) {
      return res.status(403).json({ message: "You are not authorized to delete this incident" });
    }

    const deletedIncident = await IncidentModel.findByIdAndDelete(id);

    if (!deletedIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    res.status(200).json({ message: "Incident Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const bulkDeleteIncidents = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Invalid IDs provided" });
    }

    if (isSystemAdmin(req.user)) {
      await IncidentModel.deleteMany({ _id: { $in: ids } });
      return res.status(200).json({ message: "Incidents Deleted Successfully" });
    }

    const unauthorizedCount = await IncidentModel.countDocuments({
      _id: { $in: ids },
      createdBy: { $ne: req.user.id },
    });

    if (unauthorizedCount > 0) {
      return res.status(403).json({
        message: "You can only delete incidents created by you",
      });
    }

    await IncidentModel.deleteMany({ _id: { $in: ids }, createdBy: req.user.id });
    res.status(200).json({ message: "Incidents Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
