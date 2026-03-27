import path from "path";
import IncidentModel from "./incident.model.js";

const normalizeRoleKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");

const isSystemAdmin = (user = {}) => {
  if (user?.isAdmin === true) return true;

  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.some((role) => {
    const normalized = normalizeRoleKey(role);
    return normalized === "admin" || normalized === "projectadmin" || normalized === "systemadmin";
  });
};

const canManageIncident = (incident, user = {}) => {
  if (!incident || !user?.id) return false;
  if (isSystemAdmin(user)) return true;

  return String(incident.createdBy) === String(user.id);
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

const buildIncidentPayload = (payload) => {
  const normalizedAttachments = normalizeAttachments(payload.incident_attachments, payload.incident_attachment);

  return {
    incident_title: payload.incident_title,
    incident_eventTime: payload.incident_eventTime,
    incident_recordable: payload.incident_recordable,
    incident_description: payload.incident_description,
    incident_eventDate: payload.incident_eventDate,
    incident_timeUnknown: payload.incident_timeUnknown,
    incident_isPrivate: payload.incident_isPrivate,
    distributionRoles: payload.distributionRoles,
    distributionUsers: payload.distributionUsers,
    incident_attachment: normalizedAttachments[0] || payload.incident_attachment || null,
    incident_attachments: normalizedAttachments,
    investigation_contributing_behaviour: payload.investigation_contributing_behaviour,
    investigation_contributing_condition: payload.investigation_contributing_condition,
    recordTypeForms: payload.recordTypeForms,
    observation_description: payload.observation_description,
    observation_status: payload.observation_status,
    observation_observedBy: payload.observation_observedBy,
    observation_files: payload.observation_files,
    witnesses: payload.witnesses,
    actions: payload.actions,
  };
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
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(storedName)}:/content`;

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
    const incidentPayload = buildIncidentPayload(req.body);
    const incidentNumber = await getNextIncidentNumber();

    const incident = await IncidentModel.create({
      ...incidentPayload,
      incidentNumber,
      createdBy: req.user.id,
    });

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
    await ensureIncidentNumbers();
    const incident = await IncidentModel.findById(id).populate("createdBy", "name email");
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
    const incidentPayload = buildIncidentPayload(req.body);

    const existingIncident = await IncidentModel.findById(id).select("createdBy");
    if (!existingIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
    }

    if (!canManageIncident(existingIncident, req.user)) {
      return res.status(403).json({ message: "You are not authorized to update this incident" });
    }

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      id,
      incidentPayload,
      { new: true },
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident Not Found" });
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
