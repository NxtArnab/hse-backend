import path from "path";
import IncidentModel from "./incident.model.js";

const getAccessToken = async () => {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", process.env.CLIENT_ID);
  params.append("client_secret", process.env.CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
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

    const accessToken = await getAccessToken();
    const storedName = buildStoredFileName(file.originalname);
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${process.env.SITE_ID}/drives/${process.env.DRIVE_ID}/root:/${encodeURIComponent(storedName)}:/content`;

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

    const accessToken = await getAccessToken();
    const fileContentUrl = `https://graph.microsoft.com/v1.0/sites/${process.env.SITE_ID}/drives/${process.env.DRIVE_ID}/items/${id}/content`;

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
    const {
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      distributionRoles,
      distributionUsers,
      incident_attachments,
      incident_attachment,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions
    } = req.body;

    const normalizedAttachments = Array.isArray(incident_attachments)
      ? incident_attachments.filter(Boolean)
      : incident_attachment
        ? [incident_attachment]
        : [];

    const Incident = await IncidentModel.create({
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      distributionRoles,
      distributionUsers,
      incident_attachment: normalizedAttachments[0] || incident_attachment || null,
      incident_attachments: normalizedAttachments,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions,
      createdBy: req.user.id
    });

    res
      .status(201)
      .json({ message: "Incident Created Successfully", data: Incident });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getIncidents = async (req, res) => {
  try {
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
    const {
      incident_title,
      incident_eventTime,
      incident_recordable,
      incident_description,
      incident_eventDate,
      incident_timeUnknown,
      incident_isPrivate,
      distributionRoles,
      distributionUsers,
      incident_attachments,
      incident_attachment,
      investigation_contributing_behaviour,
      investigation_contributing_condition,
      recordTypeForms,
      observation_description,
      observation_status,
      observation_observedBy,
      observation_files,
      witnesses,
      actions,
    } = req.body;

    const normalizedAttachments = Array.isArray(incident_attachments)
      ? incident_attachments.filter(Boolean)
      : incident_attachment
        ? [incident_attachment]
        : [];

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      id,
      {
        incident_title,
        incident_eventTime,
        incident_recordable,
        incident_description,
        incident_eventDate,
        incident_timeUnknown,
        incident_isPrivate,
        distributionRoles,
        distributionUsers,
        incident_attachment: normalizedAttachments[0] || incident_attachment || null,
        incident_attachments: normalizedAttachments,
        investigation_contributing_behaviour,
        investigation_contributing_condition,
        recordTypeForms,
        observation_description,
        observation_status,
        observation_observedBy,
        observation_files,
        witnesses,
        actions,
      },
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

    await IncidentModel.deleteMany({ _id: { $in: ids } });
    res.status(200).json({ message: "Incidents Deleted Successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
